import { Routes, Route } from 'react-router-dom';
import { CatalogProvider } from './context/CatalogContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DepartmentsListPage from './pages/DepartmentsListPage';
import DepartmentLayout from './layouts/DepartmentLayout';
import DepartmentHome from './pages/DepartmentHome';
import CategoryLayout from './layouts/CategoryLayout';
import CategoryHome from './pages/CategoryHome';
import SpacesPage from './pages/SpacesPage';
import CategoriesListPage from './pages/CategoriesListPage';
import SpacePage from './pages/SpacePage';
import SearchPage from './pages/SearchPage';
import StaleContentPage from './pages/StaleContentPage';
import EditorsReviewPage from './pages/EditorsReviewPage';
import MyPagesReviewPage from './pages/MyPagesReviewPage';
import ContributorsPage from './pages/ContributorsPage';
import ConfluencePageRoute from './pages/ConfluencePageRoute';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <CatalogProvider>
      <Layout>
        <ErrorBoundary>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/categories" element={<CategoriesListPage />} />
          <Route path="/category/:categoryId" element={<CategoryLayout />}>
            <Route index element={<CategoryHome />} />
            <Route path="space/:spaceKey" element={<SpacePage />} />
            <Route path="space/:spaceKey/pages/:pageId/*" element={<ConfluencePageRoute />} />
          </Route>
          <Route path="/departments" element={<DepartmentsListPage />} />
          <Route path="/department/:departmentId" element={<DepartmentLayout />}>
            <Route index element={<DepartmentHome />} />
            <Route path="space/:spaceKey" element={<SpacePage />} />
            <Route path="space/:spaceKey/pages/:pageId/*" element={<ConfluencePageRoute />} />
          </Route>
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/space/:spaceKey" element={<SpacePage />} />
          <Route path="/stale" element={<StaleContentPage />} />
          <Route path="/review/editors" element={<EditorsReviewPage />} />
          <Route path="/review/my-pages" element={<MyPagesReviewPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/contributors" element={<ContributorsPage />} />
          <Route path="/spaces/:spaceKey/pages/:pageId/*" element={<ConfluencePageRoute />} />
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </CatalogProvider>
  );
}
