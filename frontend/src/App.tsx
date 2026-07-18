import { AppRouter } from './routes/AppRouter';
import { ToastProvider } from './components/common/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}

export default App;
