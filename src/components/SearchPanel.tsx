import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { searchWebsites, getAllTechnologies } from '@/services/database';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';

interface SearchPanelProps {
  onSearch: (results: any[]) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('url');
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [selectedTechnology, setSelectedTechnology] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadTechnologies = async () => {
      const techs = await getAllTechnologies();
      setTechnologies(techs);
    };
    loadTechnologies();
  }, []);

  // Added debounce effect for live search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 0 || (searchType === 'technology' && selectedTechnology)) {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedTechnology, searchType]);

  const handleSearch = async () => {
    setIsLoading(true);
    
    try {
      let results = [];
      
      if (searchType === 'url') {
        results = await searchWebsites(query, false);
      } else if (searchType === 'technology' && selectedTechnology) {
        results = await searchWebsites(selectedTechnology, true);
      } else if (searchType === 'technology' && query) {
        results = await searchWebsites(query, true);
      }
      
      onSearch(results);
    } catch (error) {
      console.error('Error during search:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle explicit search button click
  const handleSearchButtonClick = () => {
    handleSearch();
  };

  return (
    <div className="w-full space-y-4">
      {searchType === "url" ? (
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="url-search-input">Website URL</Label>
          <div className="flex space-x-2">
            <Input 
              id="url-search-input"
              placeholder="Enter domain or URL..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button onClick={handleSearchButtonClick} disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="tech-select">Select Technology</Label>
          <div className="flex space-x-2">
            {technologies.length > 0 ? (
              <Select
                value={selectedTechnology}
                onValueChange={setSelectedTechnology}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a technology" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-72">
                    {/* Add filter input for dropdown */}
                    <div className="p-2 sticky top-0 bg-white z-10">
                      <Input
                        placeholder="Type to filter..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full mb-2"
                      />
                    </div>
                    {technologies
                      .filter(tech => tech.toLowerCase().includes(query.toLowerCase()))
                      .map((tech) => (
                        <SelectItem key={tech} value={tech}>
                          {tech}
                        </SelectItem>
                      ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            ) : (
              <Input 
                id="tech-search-input"
                placeholder="Enter technology name..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
            )}
            <Button onClick={handleSearchButtonClick} disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>
      )}
      
      {/* Radio buttons below search bar */}
      <div className="pt-2">
        <RadioGroup 
          defaultValue="url" 
          className="flex space-x-8" 
          value={searchType} 
          onValueChange={setSearchType}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="url" id="url-search" />
            <Label htmlFor="url-search">Search by Domain</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="technology" id="tech-search" />
            <Label htmlFor="tech-search">Search by Technology</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default SearchPanel;
