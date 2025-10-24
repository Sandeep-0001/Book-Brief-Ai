import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Download, Loader2, BookOpen, Sparkles, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [processingStage, setProcessingStage] = useState(0);

  // Processing stages with different messages (optimized for faster processing)
  const processingStages = [
    { text: "Uploading file..." },
    { text: "Analyzing document..."},
    { text: "Processing with AI..." },
    { text: "Generating summary..." },
    { text: "Finalizing results..." }
  ];

  const onDrop = (acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setText('');
      setSummary('');
      setError('');
      setStats(null);
      
      // Read file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setText(e.target.result);
      };
      reader.readAsText(selectedFile);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

 const handleSummarize = async () => {
  if (!file) return;

  setIsLoading(true);
  setIsProcessing(true);
  setProcessingStage(0);
  setError('');

  let stageIndex = 0;
  const totalStages = processingStages.length;

  // Cycle stages until the last one, then hold it
  const stageInterval = setInterval(() => {
    stageIndex++;
    if (stageIndex < totalStages - 1) {
      setProcessingStage(stageIndex);
    } else {
      setProcessingStage(totalStages - 1); // stay on "Finalizing results..."
      clearInterval(stageInterval);
    }
  }, 1500);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post('/api/summarize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setProgress(percentCompleted);
      },
    });

    setSummary(response.data.summary);
    setStats({
      originalLength: response.data.originalLength,
      summaryLength: response.data.summaryLength,
      compressionRatio: Math.round(
        100 - (response.data.summaryLength / response.data.originalLength) * 100
      ),
    });
  } catch (err) {
    setError(
      err.response?.data?.error || 'An error occurred while summarizing the file'
    );
  } finally {
    clearInterval(stageInterval); // always clear interval
    setIsLoading(false);
    setIsProcessing(false);
    setProgress(0);
    setProcessingStage(processingStages.length - 1); // stay on last stage ( Finalizing results...)
  }
};

  const handleDownload = () => {
    if (!summary) return;

    const element = document.createElement('a');
    const file = new Blob([summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'bookbrief_summary.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 font-sans">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-xl">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">BookBrief AI</h1>
                <p className="text-xs text-slate-500">AI-Powered Summarization</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Zap className="h-4 w-4 text-accent-500" />
              <span>AI-Powered Summarization</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl mb-6 shadow-large">
            <Sparkles className="h-10 w-10 text-white animate-bounce-subtle" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
            Transform Books into
            <span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent"> Concise Summaries</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Upload any book or document and get an intelligent, comprehensive summary powered by advanced AI
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-8 animate-slide-up">
              <div className="flex items-center mb-6">
                <div className="bg-primary-100 p-3 rounded-xl mr-4">
                  <Upload className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-800">Upload Your Document</h2>
                  <p className="text-slate-600">Support for TXT and PDF files up to 50MB</p>
                </div>
              </div>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-primary-400 bg-primary-50 scale-105'
                    : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50 hover:scale-102'
                }`}
              >
                <input {...getInputProps()} />
                <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="h-8 w-8 text-slate-500" />
                </div>
                {isDragActive ? (
                  <div>
                    <p className="text-primary-600 text-lg font-medium mb-2">Drop your file here</p>
                    <p className="text-slate-500">Release to upload</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-700 text-lg font-medium mb-2">
                      Drag & drop your file here, or <span className="text-primary-600 font-semibold">browse</span>
                    </p>
                    <p className="text-slate-500 mb-4">Supports .txt and .pdf files</p>
                    <div className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </div>
                  </div>
                )}
              </div>

              {file && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-slide-up">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600 mr-3" />
                    <div className="flex-1">
                      <p className="text-emerald-800 font-medium">{file.name}</p>
                      <p className="text-emerald-600 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready to summarize</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Text Preview */}
            {text && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-8 mt-8 animate-slide-up">
                <div className="flex items-center mb-6">
                  <div className="bg-secondary-100 p-3 rounded-xl mr-4">
                    <FileText className="h-6 w-6 text-secondary-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">Document Preview</h3>
                    <p className="text-slate-600">First 2,000 characters of your document</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-6 max-h-80 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-mono">
                    {text.substring(0, 2000)}
                    {text.length > 2000 && (
                      <span className="text-slate-500 italic">... (document continues)</span>
                    )}
                  </pre>
                </div>
              </div>
            )}

            {/* Action Button */}
            {file && (
              <div className="text-center mt-8">
                <button
                  onClick={handleSummarize}
                  disabled={isLoading}
                  className={`
                    relative overflow-hidden
                    ${isLoading 
                      ? 'bg-gradient-to-r from-slate-400 to-slate-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 cursor-pointer'
                    }
                    text-white font-semibold py-4 px-12 rounded-xl 
                    flex items-center mx-auto 
                    transition-all duration-500 ease-in-out
                    ${isLoading ? 'scale-100' : 'transform hover:scale-105 active:scale-95'}
                    shadow-medium hover:shadow-large
                    ${isLoading ? 'opacity-75' : 'opacity-100'}
                  `}
                >
                  {/* Loading background animation */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  )}
                  
                  {/* Button content */}
                  <div className="relative z-10 flex items-center">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                        <span className="animate-pulse">
                          {processingStages[processingStage]?.text || "Processing with AI..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-3 transition-transform duration-300 group-hover:rotate-12" />
                        <span>Generate Summary</span>
                      </>
                    )}
                  </div>
                  
                  {/* Ripple effect on click */}
                  {!isLoading && (
                    <div className="absolute inset-0 bg-white/20 scale-0 group-active:scale-100 transition-transform duration-150 rounded-xl"></div>
                  )}
                </button>
                
                {/* Processing status text */}
                {isLoading && (
                  <div className="mt-4 animate-fade-in">
                    <p className="text-sm text-slate-600 flex items-center justify-center">
                      <span className="text-lg mr-2 animate-bounce">
                        {processingStages[processingStage]?.icon }
                      </span>
                      <span className="animate-pulse">
                        {processingStages[processingStage]?.text || "AI is analyzing your document..."}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar */}
            {isProcessing && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-8 mt-8 animate-slide-up">
                <div className="flex items-center mb-6">
                  <div className="bg-accent-100 p-3 rounded-xl mr-4 animate-pulse">
                    <span className="text-2xl animate-bounce">
                      {processingStages[processingStage]?.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800 animate-pulse">AI Processing</h3>
                    <p className="text-slate-600 animate-pulse">
                      {processingStages[processingStage]?.text || "Analyzing and summarizing your document..."}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary-500 via-accent-500 to-primary-600 h-3 rounded-full transition-all duration-700 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span className="flex items-center">
                      <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2 animate-bounce"></div>
                      Processing...
                    </span>
                    <span className="font-semibold text-primary-600">{progress}%</span>
                  </div>
                  
                  {/* Processing steps indicator */}
                  <div className="mt-4 space-y-2">
                    {processingStages.map((stage, index) => (
                      <div key={index} className="flex items-center text-xs text-slate-500">
                        <div className={`w-2 h-2 rounded-full mr-2 transition-colors duration-500 ${
                          processingStage >= index ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
                        }`}></div>
                        <span className={`transition-all duration-300 ${
                          processingStage === index ? 'text-primary-600 font-semibold' : 'text-slate-500'
                        }`}>
                          {stage.text}
                        </span>
                        {processingStage === index && (
                          <span className="ml-2 text-primary-500 animate-bounce">⟳</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mt-8 animate-slide-up">
                <div className="flex items-start">
                  <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="text-red-800 font-semibold mb-2">Processing Error</h4>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Result */}
            {summary && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-8 mt-8 animate-slide-up">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="bg-emerald-100 p-3 rounded-xl mr-4">
                      <CheckCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-800">AI Summary</h3>
                      <p className="text-slate-600">Generated by AI</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-3 px-6 rounded-xl flex items-center transition-all duration-300 transform hover:scale-105 shadow-medium"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                  <pre className="whitespace-pre-wrap text-slate-700 leading-relaxed text-base">
                    {summary}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            {stats && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-6 animate-slide-up">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Summary Statistics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Original Length</span>
                    <span className="font-semibold text-slate-800">{stats.originalLength.toLocaleString()} chars</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Summary Length</span>
                    <span className="font-semibold text-slate-800">{stats.summaryLength.toLocaleString()} chars</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Compression</span>
                    <span className="font-semibold text-emerald-600">{stats.compressionRatio}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Features Card */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Features</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
                  <span className="text-slate-600">AI-Powered Summarization</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
                  <span className="text-slate-600">Multiple File Formats</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
                  <span className="text-slate-600">Instant Processing</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
                  <span className="text-slate-600">Download Results</span>
                </div>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl border border-primary-200 p-6">
              <div className="flex items-center mb-3">
                <Zap className="h-5 w-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-800">Powered by AI</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                Our advanced AI technology understands context, extracts key insights, and creates comprehensive summaries that preserve the essence of your content.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-slate-600">
            © 2025 BookBrief AI. Powered by Advanced AI Technology.
          </p>
        </div>
        </div>
      </footer>
    </div>
  );
}

export default App;