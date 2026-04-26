import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopBar from './components/layout/TopBar';
import Footer from './components/layout/Footer';
import CompareDrawer from './features/compare/CompareDrawer';
import HomePage from './features/home/HomePage';
import CategoryPage from './features/category/CategoryPage';
import ProductDetailPage from './features/product/ProductDetailPage';
import InsurerProfile from './features/insurer/InsurerProfile';
import ComparePage from './features/compare/ComparePage';
import SearchResults from './features/search/SearchResults';
import MethodologyPage from './features/methodology/MethodologyPage';

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-paper text-ink-900">
        <TopBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/c/:categoryId" element={<CategoryPage />} />
            <Route path="/c/:categoryId/:subcategoryId" element={<CategoryPage />} />
            <Route path="/p/:productId" element={<ProductDetailPage />} />
            <Route path="/insurer/:insurerId" element={<InsurerProfile />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/methodology" element={<MethodologyPage />} />
          </Routes>
        </main>
        <Footer />
        <CompareDrawer />
      </div>
    </BrowserRouter>
  );
}

export default App;
