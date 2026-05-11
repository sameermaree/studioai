import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { StudioLayout } from './layouts/StudioLayout';
import { Dashboard } from './pages/Dashboard';
import { Characters } from './pages/Characters';
import { Episodes } from './pages/Episodes';
import { PromptStudio } from './pages/PromptStudio';
import { VoiceStudio } from './pages/VoiceStudio';
import { Rendering } from './pages/Rendering';
import { MediaStudio } from './pages/MediaStudio';
import { Publishing } from './pages/Publishing';
import { StylePresets } from './pages/StylePresets';
import { Subtitles } from './pages/Subtitles';
import { SettingsPage } from './pages/SettingsPage';
import ComfyUIStudio from './pages/ComfyUIStudio';
import ComfyUIAdvanced from './pages/ComfyUIAdvanced';
import ComfyUIAssets from './pages/ComfyUIAssets';
import TimelineEditorPage from './pages/TimelineEditor';
import { RenderPage } from './pages/RenderPage';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<StudioLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="characters" element={<Characters />} />
            <Route path="episodes" element={<Episodes />} />
            <Route path="prompts" element={<PromptStudio />} />
            <Route path="styles" element={<StylePresets />} />
            <Route path="voice" element={<VoiceStudio />} />
            <Route path="subtitles" element={<Subtitles />} />
            <Route path="rendering" element={<Rendering />} />
            <Route path="media" element={<MediaStudio />} />
            <Route path="publishing" element={<Publishing />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="comfyui" element={<ComfyUIStudio />} />
            <Route path="comfyui/advanced" element={<ComfyUIAdvanced />} />
            <Route path="comfyui/assets" element={<ComfyUIAssets />} />
            <Route path="timeline/:timelineId" element={<TimelineEditorPage />} />
            <Route path="render/:id" element={<RenderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
