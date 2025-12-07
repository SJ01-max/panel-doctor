import boto3
import json
import os

def load_secret(secret_name: str, region_name: str = "ap-northeast-2"):
    """AWS Secret Manager에서 JSON Secret을 가져와 dict로 반환"""
    client = boto3.client("secretsmanager", region_name=region_name)

    response = client.get_secret_value(SecretId=secret_name)

    if "SecretString" in response:
        return json.loads(response["SecretString"])
    else:
        # binary 형태는 거의 없음
        return json.loads(response["SecretBinary"].decode("utf-8"))
