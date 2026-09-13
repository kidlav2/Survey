import { createRoot } from 'react-dom/client';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  root.innerHTML = `
    <main style="max-width:40rem;margin:20vh auto;padding:1.5rem;font-family:Georgia,serif;color:#3b2f24">
      <h1 style="font-size:1.75rem;margin:0 0 0.75rem">Survey is not configured</h1>
      <p style="line-height:1.5;margin:0 0 0.75rem">
        Production is missing <code>VITE_SUPABASE_URL</code> and
        <code>VITE_SUPABASE_ANON_KEY</code>. Add both in Netlify → Site configuration →
        Environment variables, then trigger a new deploy.
      </p>
    </main>
  `;
} else {
  const { default: App } = await import('./App.tsx');
  createRoot(root).render(<App />);
}
