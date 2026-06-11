import { Routes, Route } from 'react-router-dom';
import { CatalogProvider } from './context/CatalogContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import SpacePage from './pages/SpacePage';
import SearchPage from './pages/SearchPage';
import ConfluencePageRoute from './pages/ConfluencePageRoute';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CatalogProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
          <Route path="/space/:spaceKey" element={<SpacePage />} />
          <Route path="/spaces/:spaceKey/pages/:pageId/*" element={<ConfluencePageRoute />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </CatalogProvider>
  );
}
