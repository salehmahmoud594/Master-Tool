import React, { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/custom-pagination";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addEntries, searchEntries, getStats, getStoredData, extractCredentials, deleteAllEntries, exportDatabaseAsSQLite } from "@/services/ulpService";
import type { ULPEntry, UploadStats } from "@/types/ulp";
import {
  LayoutDashboard,
  Search as SearchIcon,
  Upload,
  Database,
  Clock,
  Users,
  Copy,
  Check,
  Link,
  User,
  Key,
  Hash,
  FileJson,
  FileText,
  AlertCircle,
  FileUp,
  Timer,
  Ban,
  Trash2,
} from "lucide-react";

const ITEMS_PER_PAGE = 9;

const ULPPage: React.FC = () => {
  const { toast } = useToast();
  const [searchField, setSearchField] = useState<
    "all" | "url" | "username" | "password" | "id"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ULPEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dashboardStats, setDashboardStats] = useState({
    totalPasswords: 0,
    lastUpdate: null as Date | null,
    uniqueUsers: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Initialize state
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get initial data
        const storedData = await getStoredData();
        setSearchResults(storedData);
        setTotalPages(Math.ceil(storedData.length / ITEMS_PER_PAGE));
        
        // Get dashboard stats
        const stats = await getStats();
        setDashboardStats(stats);
      } catch (error) {
        console.error("Error initializing data:", error);
        setSearchResults([]);
        setTotalPages(1);
      }
    };
    initializeData();
  }, []);const updateDashboardStats = useCallback(async () => {
    try {
      const stats = await getStats();
      setDashboardStats(stats);
    } catch (error) {
      console.error("Error updating dashboard stats:", error);
    }
  }, []);

  useEffect(() => {
    updateDashboardStats();
  }, [updateDashboardStats]);

  // Updated search functionality with proper error handling
  const handleSearch = useCallback(async () => {
    try {
      const results = searchQuery.trim()
        ? await searchEntries(searchQuery, searchField)
        : await getStoredData();

      setSearchResults(results);
      setTotalPages(Math.ceil(results.length / ITEMS_PER_PAGE));
      setPage(1);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setTotalPages(1);
      setPage(1);
    }
  }, [searchQuery, searchField]);

  useEffect(() => {
    const initializeSearch = async () => {
      await handleSearch();
    };
    initializeSearch();
  }, [handleSearch]);

  const handleSearchFieldChange = async (field: typeof searchField) => {
    setSearchField(field);
    if (searchQuery.trim()) {
      await handleSearch();
    }
  };
  const handleSearchInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!e.target.value.trim()) {
      await handleSearch(); // Show all results when query is empty
    }
  };

  const paginatedResults = searchResults.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopyStatus({ ...copyStatus, [field]: true });
    setTimeout(() => {
      setCopyStatus({ ...copyStatus, [field]: false });
    }, 2000);
  };

  const handleCopyAll = async (entry: ULPEntry) => {
    const allData = `ID: ${entry.id}\nURL: ${entry.url}\nUsername: ${entry.username}\nPassword: ${entry.password}`;
    await navigator.clipboard.writeText(allData);
    setCopyStatus({ ...copyStatus, [`all-${entry.id}`]: true });
    setTimeout(() => {
      setCopyStatus({ ...copyStatus, [`all-${entry.id}`]: false });
    }, 2000);
  };

  // Process file with enhanced error handling
  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadStats(null);

    const startTime = Date.now();
    try {
      // Progress simulation for file reading
      setUploadProgress(10);
      await new Promise(r => setTimeout(r, 100));
      // Extract credentials with enhanced validation
      const { entries, stats } = await extractCredentials(file);
      
      setUploadProgress(50);
      await new Promise(r => setTimeout(r, 100));

      if (entries.length === 0) {
        throw new Error("No valid entries found in the file");
      }

      // Process entries with validation
      const result = await addEntries(entries);
      // Update stats with detailed information
      setUploadStats({
        fileName: file.name,
        added: result.added,
        duplicates: result.duplicates,
        invalid: result.invalid,
        processingTime: stats.processingTime,
        speed: stats.speed,
        invalidDetails: stats.invalidDetails
      });

      // Update dashboard and complete progress
      await handleSearch(); // <--- Force refresh search results after upload
      updateDashboardStats();
      setUploadProgress(100);
      
    } catch (error) {
      setUploadError(
        `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setUploadProgress(0);
    } finally {
      setTimeout(() => setIsUploading(false), 500);
    }
  }, [updateDashboardStats]);

  // Fix useCallback dependency warning for processFile
  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    },
    [processFile]
  );
  const handleDeleteAll = async () => {
    try {
      setDeleting(true);
      await deleteAllEntries();
      await updateDashboardStats();
      await handleSearch(); // Refresh search results
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast({
        title: "Error",
        description: "Failed to delete entries",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  const handleExportAll = async (entries: ULPEntry[]) => {
    const exportData = entries.map(entry => ({
      URL: entry.url,
      Username: entry.username,
      Password: entry.password
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ulp_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: `${entries.length} records exported as JSON`
    });
  };


  // Render upload tab
  const renderUploadTab = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Upload ULP Data</CardTitle>
            <CardDescription>
              Drag and drop your JSON or TXT file here, or click to select
            </CardDescription>
          </div>
          <div className="flex gap-2">            {dashboardStats.totalPasswords > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            isUploading
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-blue-400"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".json,.txt"
            onChange={(e) =>
              e.target.files?.[0] && processFile(e.target.files[0])
            }
          />
          <FileUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 mb-2">
            {isUploading
              ? "Uploading..."
              : "Drop your file here or click to browse"}
          </p>
          {isUploading && (
            <Progress value={uploadProgress} className="w-full my-4" />
          )}
        </div>

        {uploadError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {uploadStats && !uploadError && (
          <Alert className="mt-4">
            <AlertTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Upload Complete
            </AlertTitle>
            <AlertDescription>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>File: {uploadStats.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-green-500" />
                  <span>Added: {uploadStats.added}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-orange-500" />
                  <span>Duplicates: {uploadStats.duplicates}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>Invalid: {uploadStats.invalid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-purple-500" />
                  <span>Time: {uploadStats.processingTime.toFixed(2)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-indigo-500" />
                  <span>Speed: {uploadStats.speed.toFixed(2)} items/s</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Expected JSON Format:</h3>
            <pre className="bg-muted p-4 rounded-lg text-sm">{`[
  {
    "URL": "example.com",
    "Username": "user1",
    "Password": "pass1"
  }
]`}</pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Expected TXT Format:</h3>
            <pre className="bg-muted p-4 rounded-lg text-sm">{`url:username:password
example.com:user1:pass1`}</pre>
          </div>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all saved ULP entries
                from your storage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );

  // Render dashboard content
  const renderDashboard = () => (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Database className="h-8 w-8 text-blue-500" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Total Passwords
            </h3>
            <p className="text-2xl font-bold">{dashboardStats.totalPasswords}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Clock className="h-8 w-8 text-green-500" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Last Update
            </h3>
            <p className="text-lg font-bold">
              {dashboardStats.lastUpdate
                ? new Date(dashboardStats.lastUpdate).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Users className="h-8 w-8 text-purple-500" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Unique Users
            </h3>
            <p className="text-2xl font-bold">{dashboardStats.uniqueUsers}</p>
          </div>
        </div>
      </Card>
    </div>
  );

  // Updated renderSearchInterface
  const renderSearchInterface = () => (
    <Card>      <CardHeader>          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Search ULP Data</h2>              {searchResults.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportAll(searchResults)}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Export Results
                </Button>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter search query..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              className="flex items-center gap-2"
              variant="default"
            >
              <SearchIcon className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/*
              { value: 'all', icon: <SearchIcon className="h-4 w-4" />, label: 'All' },
              { value: 'url', icon: <Link className="h-4 w-4" />, label: 'URL' },
              { value: 'username', icon: <User className="h-4 w-4" />, label: 'Username' },
              { value: 'password', icon: <Key className="h-4 w-4" />, label: 'Password' },
              { value: 'id', icon: <Hash className="h-4 w-4" />, label: 'ID' },
            */}
            {["all", "url", "username", "password", "id"].map((field) => (
              <Button
                key={field}
                variant={searchField === field ? "default" : "outline"}
                onClick={() => handleSearchFieldChange(field as typeof searchField)}
                className="flex items-center gap-2"
              >
                {field === "all" && <SearchIcon className="h-4 w-4" />}
                {field === "url" && <Link className="h-4 w-4" />}
                {field === "username" && <User className="h-4 w-4" />}
                {field === "password" && <Key className="h-4 w-4" />}
                {field === "id" && <Hash className="h-4 w-4" />}
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {searchResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No results found. Try a different search query.
          </div>
        ) : (
          <>            <div className="grid gap-4">
              {paginatedResults.map((entry) => (
                <Card key={entry.id} className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">Record Details</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => handleCopyAll(entry)}
                      >
                        {copyStatus[`all-${entry.id}`] ? (
                          <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>Copy All</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-3">                      <div className="bg-muted/50 p-2 rounded-lg flex items-center">
                        <div className="flex-grow">
                          <span className="text-sm text-muted-foreground">ID:</span>
                          <span className="ml-2 font-medium select-text">{entry.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">URL:</span>
                          <span className="ml-2 font-medium">{entry.url}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(entry.url, `url-${entry.id}`)}
                        >
                          {copyStatus[`url-${entry.id}`] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">Username:</span>
                          <span className="ml-2 font-medium">{entry.username}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(entry.username, `username-${entry.id}`)
                          }
                        >
                          {copyStatus[`username-${entry.id}`] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">Password:</span>
                          <span className="ml-2 font-medium">{entry.password}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(entry.password, `password-${entry.id}`)
                          }
                        >
                          {copyStatus[`password-${entry.id}`] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                {((page - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                {Math.min(page * ITEMS_PER_PAGE, searchResults.length)} of{" "}
                {searchResults.length} results
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ULP Management</h1>
        <p className="text-muted-foreground">Manage and search your ULP data</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:max-w-[400px]">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <SearchIcon className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {renderDashboard()}
        </TabsContent>

        <TabsContent value="search">{renderSearchInterface()}</TabsContent>

        <TabsContent value="upload">{renderUploadTab()}</TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all entries? This action cannot be
              undone.            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ULPPage;