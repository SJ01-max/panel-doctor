import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { BackgroundWrapper } from './components/BackgroundWrapper';

function App() {
  const basePath = typeof __BASE_PATH__ !== 'undefined' ? __BASE_PATH__ : '/';
  
  return (
    <BrowserRouter basename={basePath}>
      <BackgroundWrapper>
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto ml-64 pt-16">
            <AppRoutes />
          </main>
        </div>
      </BackgroundWrapper>
    </BrowserRouter>
  )
}

export default App
