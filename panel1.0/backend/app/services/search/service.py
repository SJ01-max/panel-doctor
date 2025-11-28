"""
통합 검색 서비스
- 자동 전략 선택
- Fallback 로직 포함
"""
from typing import Dict, Any, Optional, List
from collections import Counter
import re
from app.services.llm.parser import LlmStructuredParser
from app.services.search.strategy.selector import StrategySelector
from app.services.search.strategy.filter_first import FilterFirstSearch
from app.services.search.strategy.semantic_first import SemanticFirstSearch
from app.services.search.strategy.hybrid import HybridSearch


class SearchService:
    """통합 검색 서비스"""
    
    def __init__(self):
        self.parser = LlmStructuredParser()
        self.selector = StrategySelector()
        self._filter_search = None
        self._semantic_search = None
        self._hybrid_search = None
    
    @property
    def filter_search(self):
        """필터 검색 서비스 (lazy loading)"""
        if self._filter_search is None:
            self._filter_search = FilterFirstSearch()
        return self._filter_search
    
    @property
    def semantic_search(self):
        """의미 검색 서비스 (lazy loading)"""
        if self._semantic_search is None:
            print(f"[INFO] semantic_search 서비스 초기화 (임베딩 모델 로딩)")
            self._semantic_search = SemanticFirstSearch()
        return self._semantic_search
    
    @property
    def hybrid_search(self):
        """하이브리드 검색 서비스 (lazy loading)"""
        if self._hybrid_search is None:
            print(f"[INFO] hybrid_search 서비스 초기화 (임베딩 모델 로딩)")
            self._hybrid_search = HybridSearch()
        return self._hybrid_search
    
    def search(
        self,
        user_query: str,
        model: Optional[str] = None,
        min_results: int = 1
    ) -> Dict[str, Any]:
        """
        통합 검색 실행 (자동 전략 선택 + Fallback)
        
        Args:
            user_query: 사용자 자연어 질의
            model: 사용할 LLM 모델
            min_results: 최소 결과 수
        
        Returns:
            검색 결과 딕셔너리
        """
        print(f"[DEBUG] ========== 검색 시작 ==========")
        print(f"[DEBUG] 사용자 질의: {user_query}")
        parsed = self.parser.parse(user_query, model)
        print(f"[DEBUG] LLM 파싱 결과:")
        print(f"  filters: {parsed.get('filters')}")
        print(f"  semantic_keywords: {parsed.get('semantic_keywords')}")
        print(f"  search_text: {parsed.get('search_text')}")
        print(f"  limit: {parsed.get('limit')}")
        
        # 전략 선택
        strategy = self.selector.select_search_mode(parsed)
        print(f"[DEBUG] 선택된 전략: {strategy}")
        
        filters = parsed.get("filters", {})
        semantic_keywords = parsed.get("semantic_keywords", [])
        search_text = parsed.get("search_text")  # LLM이 생성한 풍부한 설명 문장
        limit = parsed.get("limit")
        
        # 검색 실행
        result = self._execute_search(strategy, filters, semantic_keywords, search_text, limit)
        
        print(f"[DEBUG] 초기 검색 결과: count={result.get('count', 0)}, has_results={result.get('has_results', False)}")
        
        # Fallback 로직
        if not result.get("has_results") or result.get("count", 0) < min_results:
            print(f"[DEBUG] Fallback 검토: min_results={min_results}, 현재 결과={result.get('count', 0)}")
            result = self._try_fallback(
                strategy,
                filters,
                semantic_keywords,
                parsed.get("search_text"),
                limit,
                result
            )
        
        # -----------------------
        # Server-side Aggregation: gender / age / region 통계 계산
        # -----------------------
        try:
            results_list: List[Dict[str, Any]] = result.get("results", []) or []
            if results_list:
                gender_stats, age_stats, region_stats = self._compute_basic_stats(results_list)
                
                # FilterFirstSearch에서 이미 내려준 통계가 있으면 그대로 사용하고,
                # 없을 때만 채워 넣는다.
                if "gender_stats" not in result or not result.get("gender_stats"):
                    result["gender_stats"] = gender_stats
                if "age_stats" not in result or not result.get("age_stats"):
                    result["age_stats"] = age_stats
                if "region_stats" not in result or not result.get("region_stats"):
                    result["region_stats"] = region_stats
        except Exception as e:
            print(f"[WARN] server-side 통계 계산 중 오류 (무시): {e}")
        
        # 결과에 메타데이터 추가
        result["parsed_query"] = parsed
        result["selected_strategy"] = strategy
        result["strategy_info"] = self.selector.get_strategy_info(strategy)
        
        # semantic_first 또는 hybrid 전략일 때 확장 필드 생성 (semantic_keywords가 있는 경우)
        has_semantic_keywords = bool(semantic_keywords and len(semantic_keywords) > 0)
        if (strategy == "semantic_first" or (strategy == "hybrid" and has_semantic_keywords)) and result.get("has_results") and result.get("count", 0) > 0:
            try:
                print(f"[INFO] {strategy} 전략 확장 필드 생성 시작 (semantic_keywords: {len(semantic_keywords) if semantic_keywords else 0}개)...")
                from app.services.semantic.auto_dictionary import generate_expanded_keywords
                from app.services.semantic.features import extract_panel_features
                from app.services.semantic.match_reason import generate_match_reasons
                from app.services.semantic.common_insights import generate_common_features
                from app.services.semantic.semantic_keywords import generate_semantic_keywords
                
                results = result.get("results", [])
                top_panels = results[:20]  # 상위 20개만 처리 (성능 최적화)
                
                # 0. 자동 사전 생성 (expanded_keywords)
                expanded_keywords = generate_expanded_keywords(user_query)
                print(f"[INFO] 자동 사전 생성 완료: {len(expanded_keywords)}개 키워드")
                
                # 패널 텍스트 수집 (TF-IDF 계산용)
                all_panel_texts = []
                for panel_row in top_panels:
                    panel_text = panel_row.get("json_doc") or panel_row.get("content") or ""
                    if isinstance(panel_text, dict):
                        import json
                        panel_text = json.dumps(panel_text, ensure_ascii=False)
                    elif not isinstance(panel_text, str):
                        panel_text = str(panel_text)
                    all_panel_texts.append(panel_text)
                
                # 1. 각 패널의 features 추출 (TF-IDF 기반 affinity 포함)
                # 주의: extract_panel_features 내부에서 extract_car_entities를 개별 호출하지 않도록 수정 필요
                panel_features_list = []
                for idx, panel_row in enumerate(top_panels):
                    try:
                        features = extract_panel_features(
                            panel_row,
                            expanded_keywords=expanded_keywords,
                            all_panel_texts=all_panel_texts  # 전체 텍스트 전달 (TF-IDF 계산용)
                        )
                        panel_features_list.append(features)
                    except Exception as e:
                        print(f"[WARN] 패널 {idx} features 추출 실패 (무시): {e}")
                        continue
                
                # 2. common_features 생성 (상위 10개 패널만 사용 - 성능 최적화)
                common_features = []
                if panel_features_list:
                    try:
                        # 상위 10개 패널만으로 공통 특징 생성 (성능 최적화)
                        top_10_features = panel_features_list[:10]
                        common_features = generate_common_features(top_10_features)
                        print(f"[INFO] common_features 생성 완료: {len(common_features)}개 (상위 10개 패널 기반)")
                    except Exception as e:
                        print(f"[WARN] common_features 생성 실패 (무시): {e}")
                
                # 3. matching_keywords 확장 생성 (자동 사전 키워드 우선 사용, LLM 확장은 선택적)
                matching_keywords = semantic_keywords.copy() if semantic_keywords else []
                
                # 자동 사전 키워드 추가 (빠름)
                for kw in expanded_keywords:
                    if kw not in matching_keywords:
                        matching_keywords.append(kw)
                
                # LLM 기반 확장은 선택적 (성능 최적화: 필요시에만)
                ENABLE_LLM_KEYWORD_EXPANSION = False  # 기본값: False (자동 사전만 사용)
                if ENABLE_LLM_KEYWORD_EXPANSION and common_features:
                    try:
                        llm_expanded = generate_semantic_keywords(
                            query=user_query,
                            common_features=common_features,
                            top_panel_features=[f.to_dict() for f in panel_features_list[:5]]  # 상위 5개만
                        )
                        # 기존 키워드와 합치기 (중복 제거)
                        for kw in llm_expanded:
                            if kw not in matching_keywords:
                                matching_keywords.append(kw)
                        print(f"[INFO] matching_keywords LLM 확장 완료: {len(matching_keywords)}개")
                    except Exception as e:
                        print(f"[WARN] matching_keywords LLM 확장 실패 (무시): {e}")
                
                # 4. summary_sentence 생성
                summary_sentence = f"이 검색은 {len(results)}명의 패널이 발견되었으며, 평균 유사도 점수가 높게 나타났습니다."
                if common_features and len(common_features) > 0:
                    summary_sentence = f"이 검색은 {common_features[0]} 등의 공통 성향을 가진 {len(results)}명의 패널이 발견되었습니다."
                
                # 5. 각 패널에 match_reasons 추가 (상위 10개만 - 성능 최적화)
                for idx, panel_row in enumerate(top_panels[:10]):
                    try:
                        panel_features = panel_features_list[idx] if idx < len(panel_features_list) else None
                        panel_text = all_panel_texts[idx] if idx < len(all_panel_texts) else ""
                        distance = panel_row.get("distance", 2.0)
                        score = max(0, min(100, int((1 - distance / 2.0) * 100)))
                        
                        if panel_features:
                            match_reasons = generate_match_reasons(
                                query=user_query,
                                panel_features=panel_features,
                                panel_text=panel_text[:500] if panel_text else "",
                                score=score
                            )
                            panel_row["match_reasons"] = match_reasons
                    except Exception as e:
                        print(f"[WARN] 패널 {idx} match_reasons 생성 실패 (무시): {e}")
                        continue
                
                # 확장 필드를 result에 추가
                result["matching_keywords"] = matching_keywords
                result["common_features"] = common_features
                result["summary_sentence"] = summary_sentence
                
                print(f"[INFO] {strategy} 전략 확장 필드 생성 완료")
            except Exception as e:
                import traceback
                print(f"[ERROR] semantic_first 확장 필드 생성 중 오류 (무시): {e}")
                print(f"[ERROR] 상세:\n{traceback.format_exc()}")
                # 오류가 나도 기본 결과는 반환
        
        # ★ 사용자가 요청한 limit이 있으면 최종 결과에 적용
        # (전략에서 DEFAULT_LIMIT을 사용했을 수 있으므로 명시적으로 제한)
        if limit is not None and limit > 0:
            results_list = result.get("results", [])
            if results_list and len(results_list) > limit:
                print(f"[DEBUG] 사용자 요청 limit({limit}) 적용: {len(results_list)}개 → {limit}개로 제한")
                result["results"] = results_list[:limit]
                result["count"] = limit
                # total_count는 그대로 유지 (전체 매칭 개수)
        
        print(f"[DEBUG] ========== 최종 결과 ==========")
        print(f"  전략: {strategy}")
        print(f"  요청 limit: {limit}")
        print(f"  결과 개수: {result.get('count', 0)}")
        if 'total_dataset_stats' in result:
            print(f"  total_dataset_stats 포함됨: total_count={result['total_dataset_stats'].get('total_count', 0)}")
        else:
            print(f"  total_dataset_stats 없음")
        print(f"  ====================================")
        
        return result
    
    def _compute_basic_stats(self, results: List[Dict[str, Any]]):
        """
        검색 결과 행 리스트에서 성별 / 연령대 / 지역 분포를 계산한다.
        - 성별: 남성 / 여성 / 기타
        - 연령대: 10s / 20s / ... (FilterFirstSearch의 age_stats 형식과 맞춤)
        - 지역: region의 첫 단어 기준 (예: '서울 강남구' -> '서울')
        """
        gender_counter: Counter = Counter()
        age_counter: Counter = Counter()
        region_counter: Counter = Counter()

        for row in results:
            # ----- 성별 -----
            gender_raw = (row.get("gender") or "").strip()
            if gender_raw:
                if gender_raw in ["M", "남", "남성", "남자"]:
                    gender_key = "M"
                elif gender_raw in ["F", "여", "여성", "여자"]:
                    gender_key = "F"
                else:
                    gender_key = "기타"
                gender_counter[gender_key] += 1

            # ----- 연령대 -----
            age_val = row.get("age")
            age_text = row.get("age_text") or ""
            age_num = None

            if isinstance(age_val, (int, float)) and age_val > 0:
                age_num = int(age_val)
            else:
                m = re.search(r"(\d+)\s*세", str(age_text))
                if m:
                    try:
                        age_num = int(m.group(1))
                    except ValueError:
                        age_num = None

            if age_num is not None and 10 <= age_num < 100:
                decade = (age_num // 10) * 10
                age_group = f"{decade}s"  # 20s, 30s ...
                age_counter[age_group] += 1

            # ----- 지역 -----
            region_raw = (row.get("region") or "").strip()
            if region_raw:
                main_region = region_raw.split()[0]
                region_counter[main_region] += 1

        gender_stats = [
            {"gender": gender, "gender_count": count}
            for gender, count in gender_counter.items()
        ]
        age_stats = [
            {"age_group": group, "age_count": count}
            for group, count in age_counter.items()
        ]
        region_stats = [
            {"region": region, "region_count": count}
            for region, count in region_counter.items()
        ]

        # 일관된 순서를 위해 간단 정렬
        gender_order = {"M": 0, "F": 1}
        gender_stats.sort(key=lambda x: gender_order.get(x["gender"], 99))
        age_stats.sort(key=lambda x: x["age_group"])
        region_stats.sort(key=lambda x: x["region"])

        return gender_stats, age_stats, region_stats
    
    def _execute_search(
        self,
        strategy: str,
        filters: Dict[str, Any],
        semantic_keywords: list,
        search_text: Optional[str] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """검색 전략에 따라 검색 실행"""
        if strategy == "filter_first":
            return self.filter_search.search(filters=filters, limit=limit)
        elif strategy == "semantic_first":
            # Pure Vector Search: search_text 우선 사용 (LLM이 생성한 풍부한 설명 문장)
            return self.semantic_search.search(
                semantic_keywords=semantic_keywords, 
                search_text=search_text,
                limit=limit
            )
        elif strategy == "hybrid":
            # ★ search_text 전달 (LLM이 생성한 풍부한 설명 문장)
            return self.hybrid_search.search(
                filters=filters, 
                semantic_keywords=semantic_keywords,
                search_text=search_text,  # LLM이 생성한 풍부한 설명 문장 전달
                limit=limit
            )
        else:
            return {
                "results": [],
                "count": 0,
                "strategy": strategy,
                "has_results": False,
                "error": f"알 수 없는 전략: {strategy}"
            }
    
    def _try_fallback(
        self,
        original_strategy: str,
        filters: Dict[str, Any],
        semantic_keywords: list,
        search_text: Optional[str] = None,
        limit: Optional[int] = None,
        original_result: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Fallback 로직"""
        fallback_result = original_result.copy()
        fallback_result["fallback_attempted"] = True
        
        if original_strategy == "semantic_first":
            # semantic_first 결과가 없을 때 fallback 시도
            # 1. distance_threshold를 완화하여 재시도
            if not original_result.get("has_results") or original_result.get("count", 0) == 0:
                print(f"[INFO] Fallback 실행: semantic_first (distance_threshold 완화)")
                # distance_threshold를 None으로 설정하여 모든 결과를 가져온 후 벡터 정렬만 적용
                from app.services.data.vector import VectorSearchService
                vector_service = VectorSearchService()
                # search_text 우선 사용, 없으면 semantic_keywords 결합
                fallback_search_text = search_text or (" ".join(semantic_keywords) if semantic_keywords else "")
                if fallback_search_text:
                    try:
                        fallback_results = vector_service.execute_hybrid_search_sql(
                            embedding_input=fallback_search_text,
                            filters=None,
                            limit=limit or 500,
                            distance_threshold=None,  # distance threshold 제거
                            semantic_keywords=None  # 키워드 필터링도 제거 (Pure Vector Search)
                        )
                        if fallback_results and len(fallback_results) > 0:
                            fallback_result = {
                                "results": fallback_results,
                                "count": len(fallback_results),
                                "total_count": len(fallback_results),
                                "strategy": "semantic_first",
                                "keywords_used": semantic_keywords,
                                "has_results": True,
                                "fallback_used": "semantic_first_no_threshold"
                            }
                            print(f"[INFO] Fallback 성공: {len(fallback_results)}개 결과")
                    except Exception as e:
                        print(f"[WARN] Fallback 실패: {e}")
            
            # 2. 필터가 있으면 hybrid로 fallback
            has_filters = bool(filters) and any(v is not None and v != "" for v in filters.values())
            if has_filters and (not fallback_result.get("has_results") or fallback_result.get("count", 0) == 0):
                print(f"[INFO] Fallback 실행: semantic_first → hybrid")
                hybrid_result = self.hybrid_search.search(filters=filters, semantic_keywords=semantic_keywords, limit=limit)
                if hybrid_result.get("has_results") and hybrid_result.get("count", 0) > fallback_result.get("count", 0):
                    fallback_result = hybrid_result
                    fallback_result["fallback_used"] = "hybrid"
        
        elif original_strategy == "filter_first":
            has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
            if has_semantic:
                print(f"[INFO] Fallback 실행: filter_first → semantic_first")
                semantic_result = self.semantic_search.search(
                    semantic_keywords=semantic_keywords, 
                    search_text=search_text,
                    limit=limit
                )
                if semantic_result.get("has_results") and semantic_result.get("count", 0) > original_result.get("count", 0):
                    fallback_result = semantic_result
                    fallback_result["fallback_used"] = "semantic_first"
        
        elif original_strategy == "hybrid":
            # 하이브리드 검색에서 키워드 필터링이 너무 엄격해서 결과가 0개일 때
            # 키워드 필터링 없이 벡터 검색만 시도 (구조적 필터는 유지)
            has_filters = bool(filters) and any(v is not None and v != "" for v in filters.values())
            has_semantic = bool(semantic_keywords) and len(semantic_keywords) > 0
            
            if has_filters and has_semantic:
                # 키워드 필터링 없이 구조적 필터 + 벡터 검색만 시도
                print(f"[INFO] Fallback 실행: hybrid (키워드 필터링 제거) → 구조적 필터 + 벡터 검색")
                from app.services.data.vector import VectorSearchService
                vector_service = VectorSearchService()
                search_text = " ".join(semantic_keywords)
                
                try:
                    # 키워드 필터링 없이 벡터 검색만 실행 (구조적 필터는 유지)
                    fallback_results = vector_service.execute_hybrid_search_sql(
                        embedding_input=search_text,
                        filters=filters,
                        limit=limit if limit is not None else 1000,
                        distance_threshold=None,
                        semantic_keywords=None  # 키워드 필터링 제거
                    )
                    
                    if fallback_results and len(fallback_results) > 0:
                        print(f"[INFO] Fallback 성공: {len(fallback_results)}개 결과 (키워드 필터링 제거)")
                        fallback_result = {
                            "results": fallback_results,
                            "count": len(fallback_results),
                            "total_count": len(fallback_results),
                            "strategy": "hybrid",
                            "filters_applied": filters or {},
                            "keywords_used": semantic_keywords,
                            "has_results": True,
                            "fallback_used": "hybrid_no_keyword_filter"
                        }
                except Exception as e:
                    print(f"[WARN] Fallback 실패: {e}")
                    # Fallback 실패 시 원본 결과 반환
        
        return fallback_result

