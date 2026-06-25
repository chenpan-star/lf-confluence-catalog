import { Routes, Route } from 'react-router-dom';
import { CatalogProvider } from './context/CatalogContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DepartmentsListPage from './pages/DepartmentsListPage';
import DepartmentPage from './pages/DepartmentPage';
import SpacesPage from './pages/SpacesPage';
import CategoriesListPage from './pages/CategoriesListPage';
import CategoryPage from './pages/CategoryPage';
import SpacePage from './pages/SpacePage';
import SearchPage from './pages/SearchPage';
import StaleContentPage from './pages/StaleContentPage';
import ContributorsPage from './pages/ContributorsPage';
import ConfluencePageRoute from './pages/ConfluencePageRoute';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CatalogProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/departments" element={<DepartmentsListPage />} />
          <Route path="/department/:departmentId" element={<DepartmentPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/categories" element={<CategoriesListPage />} />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
          <Route path="/space/:spaceKey" element={<SpacePage />} />
          <Route path="/stale" element={<StaleContentPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/contributors" element={<ContributorsPage />} />
          <Route path="/spaces/:spaceKey/pages/:pageId/*" element={<ConfluencePageRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </CatalogProvider>
  );
}
