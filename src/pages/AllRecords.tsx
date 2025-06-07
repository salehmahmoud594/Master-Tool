import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useDatabase,
  getAllWebsitesWithTechnologies,
  deleteWebsite,
  deleteAllData,
} from "@/services/database";
import ResultsDisplay from "@/components/ResultsDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ArrowLeft, ArrowDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AllRecords = () => {
  const { isReady } = useDatabase();
  interface WebsiteRecord {
    url: string;
    technologies: string[];
    [key: string]: unknown; // Use 'unknown' instead of 'any' for safer typing
  }

  const [records, setRecords] = useState<WebsiteRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showUndoAlert, setShowUndoAlert] = useState(false);
  const [deletedData, setDeletedData] = useState<WebsiteRecord | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAllRecords = async () => {
      if (isReady) {
        setIsLoading(true);
        try {
          const allData = await getAllWebsitesWithTechnologies();
          setRecords(allData);
        } catch (error) {
          console.error("Error fetching all records:", error);
          toast({
            title: "Error",
            description: "Failed to fetch records from database.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchAllRecords();
  }, [isReady, toast]);

  const handleDeleteRecord = async (url: string) => {
    try {
      // Find the record before deleting it
      const deletedRecord = records.find((item) => item.url === url);

      const success = await deleteWebsite(url);
      if (success) {
        // Store the deleted record
        setDeletedData(deletedRecord);

        // Update the records list
        setRecords((prevRecords) =>
          prevRecords.filter((item) => item.url !== url)
        );

        // Show notification with undo option
        setShowUndoAlert(true);
        toast({
          title: "Record Deleted",
          description: `Record for ${url} has been removed.`,
        });

        // Hide undo option after 10 seconds
        setTimeout(() => {
          setShowUndoAlert(false);
          setDeletedData(null);
        }, 10000);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the record.",
        variant: "destructive",
      });
    }
  };

  const handleUndoDelete = () => {
    setShowUndoAlert(false);
    if (deletedData) {
      setRecords((prev) => [...prev, deletedData]);
      setDeletedData(null);
      toast({
        title: "Delete Undone",
        description: "Record has been restored.",
      });
    }
  };

  const exportAsCSV = () => {
    // Convert data to CSV format
    const csvContent = [
      "url,technologies",
      ...records.map(
        (item) =>
          `${item.url},[${
            item.technologies && item.technologies.length > 0
              ? item.technologies.join(",")
              : ""
          }]`
      ),
    ].join("\n");

    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "all-records.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAll = async () => {
    try {
      // Store the current records before deleting
      const allRecords = [...records];

      // Delete all records
      const success = await deleteAllData();
      if (success) {
        // Clear the records list
        setRecords([]);

        // Show notification with undo option
        setShowUndoAlert(true);
        toast({
          title: "All Records Deleted",
          description: "All records have been removed.",
        });

        // Hide undo option after 10 seconds
        setTimeout(() => {
          setShowUndoAlert(false);
          setDeletedData(null);
        }, 10000);
      }
    } catch (error) {
      console.error("Error deleting all records:", error);
      toast({
        title: "Delete All Failed",
        description: "An error occurred while deleting all records.",
        variant: "destructive",
      });
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Initializing Database...</h1>
          <p className="text-gray-600">
            Please wait while we set up the local database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            All Database Records
          </h1>
          <p className="text-gray-600">
            View and manage all website technology data
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportAsCSV}
              className="flex items-center gap-2"
            >
              <ArrowDown className="h-4 w-4" />
              Export All as CSV
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAll}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>

        {/* Undo alert */}
        {showUndoAlert && (
          <div className="mb-4">
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>Record has been deleted.</span>
                <Button variant="outline" size="sm" onClick={handleUndoDelete}>
                  Undo
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              All Website Records ({records.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading records...</p>
              </div>
            ) : (
              <ResultsDisplay
                results={records}
                onDeleteRecord={handleDeleteRecord}
              />
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Website Tech Database - Using Local SQLite Storage
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AllRecords;
