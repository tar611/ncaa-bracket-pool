import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BracketPage } from "./pages/BracketPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";

function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 text-neutral-100">
      <div className="flex gap-4">
        <Link to="/bracket" className="hover:text-emerald-400">
          My Bracket
        </Link>
        <Link to="/leaderboard" className="hover:text-emerald-400">
          Leaderboard
        </Link>
      </div>
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <span>{user.displayName}</span>
        <button type="button" onClick={logout} className="hover:text-red-400">
          Log out
        </button>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-neutral-950">
          <NavBar />
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/bracket"
              element={
                <ProtectedRoute>
                  <BracketPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/bracket" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
