import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { ReelsLayout } from './utilities/reels/ReelsLayout'
import { BrandPage } from './utilities/reels/pages/BrandPage'
import { EffectsPage } from './utilities/reels/pages/EffectsPage'
import { ProjectPage } from './utilities/reels/pages/ProjectPage'
import { ProjectsPage } from './utilities/reels/pages/ProjectsPage'
import { RulesPage } from './utilities/reels/pages/RulesPage'
import { SetupPage } from './utilities/reels/pages/SetupPage'
import { SkillsPage } from './utilities/reels/pages/SkillsPage'

function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="display text-6xl">No existeix</p>
      <p className="mt-2 text-muted">Aquesta adreça no porta a cap utilitat.</p>
      <Link to="/" className="mt-4 inline-block font-semibold text-accent">
        Tornar a l’inici
      </Link>
    </div>
  )
}

export function App() {
  return (
    // HashRouter: GitHub Pages no reescriu les rutes a index.html.
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="reels" element={<ReelsLayout />}>
            <Route index element={<ProjectsPage />} />
            <Route path="projectes/:id" element={<ProjectPage />} />
            <Route path="preparacio" element={<SetupPage />} />
            <Route path="marca" element={<BrandPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="efectes" element={<EffectsPage />} />
            <Route path="regles" element={<RulesPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
