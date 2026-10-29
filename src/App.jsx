import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.jsx';
import { ToastProvider } from './components/ui/ToastProvider.jsx';
import { AuthProvider } from './state/AuthProvider.jsx';
import { KallpaProvider } from './state/KallpaProvider.jsx';
import AccountPage from './pages/AccountPage.jsx';
import AssessmentPage from './pages/AssessmentPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DiagnosisPage from './pages/DiagnosisPage.jsx';
import FaqPage from './pages/FaqPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OccupationsPage from './pages/OccupationsPage.jsx';
import PassportPage from './pages/PassportPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RoutePage from './pages/RoutePage.jsx';

/**
 * Rutas de KALLPA. Se usa HashRouter para que el build funcione en
 * cualquier servidor estático sin configuración adicional.
 */
export default function App() {
  return (
    <KallpaProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="como-funciona" element={<Navigate to="/" replace />} />
                <Route path="diagnostico" element={<DiagnosisPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="evaluacion" element={<AssessmentPage />} />
                <Route path="ocupaciones" element={<OccupationsPage />} />
                <Route path="ruta" element={<RoutePage />} />
                <Route path="pasaporte" element={<PassportPage />} />
                <Route path="cv" element={<Navigate to="/ocupaciones" replace />} />
                <Route path="preguntas-frecuentes" element={<FaqPage />} />
                <Route path="iniciar-sesion" element={<AuthPage mode="login" key="login" />} />
                <Route path="crear-cuenta" element={<AuthPage mode="register" key="register" />} />
                <Route path="cuenta" element={<AccountPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </KallpaProvider>
  );
}
