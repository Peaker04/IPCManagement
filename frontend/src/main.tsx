import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './app/store'
import './styles/index.css'
import './styles/components/dashboard.css'
import './styles/components/tables.css'
import './styles/components/shell.css'
import './styles/components/operations.css'
import './styles/components/documents.css'
import './styles/components/domain-pages.css'
import './styles/components/responsive.css'
import './styles/ui-redesign.css'
import './styles/redesign/fiori.css'
import './styles/redesign/demand.css'
import './styles/redesign/responsive.css'
import './styles/redesign/dashboard.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
