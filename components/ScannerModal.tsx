
import React, { useEffect } from 'react';
import { X, Camera } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  useEffect(() => {
    let html5QrcodeScanner: any = null;

    if (isOpen) {
      // @ts-ignore
      if (window.Html5QrcodeScanner) {
        // @ts-ignore
        html5QrcodeScanner = new window.Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
          },
          /* verbose= */ false
        );
        
        html5QrcodeScanner.render(
          (decodedText: string) => {
            onScan(decodedText);
            html5QrcodeScanner.clear();
            onClose();
          },
          (errorMessage: string) => {
            // parse error, ignore it.
          }
        );
      }
    }

    return () => {
      if (html5QrcodeScanner) {
        try {
          html5QrcodeScanner.clear();
        } catch (e) {
          // Ignore clear errors if already cleared
        }
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 z-[110] bg-white/20 p-3 rounded-full text-white backdrop-blur-md"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-md px-4">
        <div className="text-white text-center mb-6">
           <Camera size={48} className="mx-auto mb-2 opacity-80" />
           <h3 className="text-xl font-bold">掃描條碼</h3>
           <p className="text-white/60 text-sm">請將條碼對準框線中心</p>
        </div>
        
        <div id="reader" className="w-full bg-black rounded-3xl overflow-hidden border border-white/20 shadow-2xl"></div>
        
        <div className="text-center mt-6">
           <button onClick={onClose} className="text-white/50 text-sm hover:text-white underline">取消掃描</button>
        </div>
      </div>
    </div>
  );
};
