import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Home } from './pages/Home'
import { ReelsLayout } from './utilities/reels/ReelsLayout'
import { AutoPage } from './utilities/reels/auto/AutoPage'
import { AutoProjectPage } from './utilities/reels/auto/AutoProjectPage'
import { BrandPage } from './utilities/reels/pages/BrandPage'
import { EffectsPage } from './utilities/reels/pages/EffectsPage'
import { ProjectPage } from './utilities/reels/pages/ProjectPage'
import { ProjectsPage } from './utilities/reels/pages/ProjectsPage'
import { RulesPage } from './utilities/reels/pages/RulesPage'
import { SetupPage } from './utilities/reels/pages/SetupPage'
import { SkillsPage } from './utilities/reels/pages/SkillsPage'
import { TutorialsLayout } from './utilities/tutorials/TutorialsLayout'
import { ProjectsPage as TutorialsProjectsPage } from './utilities/tutorials/pages/ProjectsPage'
import { TemplatesPage } from './utilities/tutorials/pages/TemplatesPage'
import { TutorialPage } from './utilities/tutorials/pages/TutorialPage'
import { VoicesPage } from './utilities/tutorials/pages/VoicesPage'

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
            <Route path="auto" element={<AutoPage />} />
            <Route path="auto/:id" element={<AutoProjectPage />} />
            <Route path="preparacio" element={<SetupPage />} />
            <Route path="marca" element={<BrandPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="efectes" element={<EffectsPage />} />
            <Route path="regles" element={<RulesPage />} />
          </Route>
          <Route path="tutorials" element={<TutorialsLayout />}>
            <Route index element={<TutorialsProjectsPage />} />
            <Route path="plantilles" element={<TemplatesPage />} />
            <Route path="veus" element={<VoicesPage />} />
            <Route path=":id" element={<TutorialPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
