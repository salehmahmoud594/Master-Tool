import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { insertWebsiteData } from '@/services/database';
import { Upload } from 'lucide-react';

interface CsvUploaderProps {
  onUploadComplete: () => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Robust parser for both CSV and TXT with [Tech1,Tech2,...] at end
  const parseCsvContent = useCallback((content: string) => {
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.map(line => {
      // Try to match: url [Tech1,Tech2,...]
      const match = line.match(/^(\S+)(?:\s*\[(.*)\])?$/);
      if (!match) return { url: '', technologies: [] };
      const url = match[1];
      const techString = match[2];
      const technologies = techString ? techString.split(',').map(t => t.trim()).filter(Boolean) : [];
      return { url, technologies };
    }).filter(item => item.url);
  }, []);

  const validateCsvData = (data: { url: string; technologies: string[] }[]) => {
    // Check if there's at least one valid entry
    if (data.length === 0) {
      return { valid: false, message: "No valid data found in the file." };
    }

    // Check for missing URLs
    const missingUrls = data.filter(item => !item.url.trim());
    if (missingUrls.length > 0) {
      return { valid: false, message: `${missingUrls.length} entries missing URLs.` };
    }

    // All checks passed
    return { valid: true, message: "" };
  };

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const data = parseCsvContent(content);
      console.log('Parsed data:', data); // DEBUG: See what is parsed from the file
      // Validate the data
      const validation = validateCsvData(data);
      if (!validation.valid) {
        toast({
          title: "Invalid CSV Format",
          description: validation.message,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }
      
      if (data.length > 0) {
        const success = await insertWebsiteData(data);
        
        if (success) {
          toast({
            title: "Upload Successful",
            description: `Processed ${data.length} website records.`,
          });
          onUploadComplete();
        } else {
          toast({
            title: "Upload Failed",
            description: "Failed to insert data into the database.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "No Data Found",
          description: "No valid data found in the uploaded file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred while processing the file.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, onUploadComplete, parseCsvContent]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        } transition-colors duration-200 cursor-pointer`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id="file-upload"
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
        <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
          <Upload size={36} className="text-blue-500 mb-4" />
          <h3 className="text-lg font-semibold">Drag & drop your CSV file here</h3>
          <p className="text-gray-500 mt-2">or click to browse</p>
          {isProcessing && <p className="text-blue-600 mt-4">Processing file...</p>}
        </label>
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>Expected format:</p>
        <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
          https://example.com [Technology1,Technology2,Technology3]
        </pre>
      </div>
    </div>
  );
};

export default CsvUploader;
