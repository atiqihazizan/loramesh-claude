// Upload GeoJSON file → POST /boundaries/upload

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { errMsg } from '../../../lib/api.js';
import Spinner from '../../ui/Spinner.jsx';

export default function BoundaryUploadPanel({
  onUpload,
  isUploading,
  disabled,
}) {
  const inputRef = useRef(null);
  const [namePrefix, setNamePrefix] = useState('Zon');
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    try {
      await onUpload({ file, namePrefix: namePrefix.trim() || 'Zon' });
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Upload GeoJSON
      </p>
      <div>
        <label className="label" htmlFor="boundary-prefix">
          Prefix nama
        </label>
        <input
          id="boundary-prefix"
          className="input text-sm"
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
          placeholder="Zon"
          disabled={disabled || isUploading}
        />
        <p className="mt-1 text-xs text-slate-500">
          Auto: Zon 1, Zon 2… jika tiada nama dalam fail.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.geojson,application/json,application/geo+json"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="btn-secondary w-full text-sm"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Spinner size={16} className="text-brand-600" />
        ) : (
          <Upload size={16} />
        )}
        {isUploading ? 'Memuat naik…' : 'Pilih fail .geojson'}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
