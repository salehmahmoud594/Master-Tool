import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Trash } from 'lucide-react';

interface Website {
  url: string;
  technologies: string[];
}

interface ResultsDisplayProps {
  results: Website[];
  onDeleteRecord?: (url: string) => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, onDeleteRecord }) => {
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No results found.</p>
        <p className="text-sm text-gray-400 mt-2">Try uploading CSV data or modifying your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="text-sm text-gray-500 mb-2">
        <h3 className="font-medium text-lg">Website Technologies ({results.length} result{results.length !== 1 ? 's' : ''})</h3>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Website URL</TableHead>
              <TableHead>Technologies</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((site, index) => (
              <TableRow key={index}>
                <TableCell>
                  <a 
                    href={site.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline text-blue-600"
                  >
                    {site.url}
                  </a>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {site.technologies.filter(Boolean).map((tech, techIndex) => (
                      <Badge key={techIndex} variant="outline">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {onDeleteRecord && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onDeleteRecord(site.url)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ResultsDisplay;
