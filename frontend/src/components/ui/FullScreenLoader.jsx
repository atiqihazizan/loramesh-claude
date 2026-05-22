// src/components/ui/FullScreenLoader.jsx
import Spinner from './Spinner.jsx';

export default function FullScreenLoader({ message = 'Loading...' }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3">
      <Spinner size={32} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
