import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, ExternalLink, Code2 } from 'lucide-react';
import { getStandaloneHtmlCode } from '../utils/standaloneCode';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ isOpen, onClose }) => {
  const [code, setCode] = useState<string>('Carregando código...');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      getStandaloneHtmlCode().then((text) => setCode(text));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'racha-tiktok-live.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Código num Único Ficheiro HTML</h3>
              <p className="text-xs text-slate-400">
                HTML + CSS + JavaScript Vanilla + Canvas 2D + Socket.io embutidos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Baixar .html</span>
            </button>

            <a
              href="/racha-standalone.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Abrir em Nova Aba</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative banner */}
        <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>
            💡 O arquivo está pronto para uso direto no <strong>OBS Studio</strong> (como Fonte de Navegador / Browser Source 1080x1920) ou qualquer navegador web.
          </span>
          <span className="text-[11px] font-mono text-cyan-400">const socket = io('URL_DO_SEU_BACKEND');</span>
        </div>

        {/* Code View */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950">
          <pre className="text-xs text-slate-300 font-mono leading-relaxed select-all">
            {code}
          </pre>
        </div>
      </div>
    </div>
  );
};
