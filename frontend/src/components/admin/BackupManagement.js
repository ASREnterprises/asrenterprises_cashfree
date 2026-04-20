import { useState, useEffect } from "react";
import { Database, Download, Trash2, RefreshCw, Clock, HardDrive, CheckCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const fetchBackups = async () => {
    try {
      const res = await axios.get(`${API}/admin/backup/list`);
      setBackups(res.data.backups || []);
    } catch (error) {
      console.error("Fetch backups error:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await axios.post(`${API}/admin/backup/create`);
      if (res.data.success) {
        alert(`Backup created successfully!\nFile: ${res.data.filename}\nSize: ${res.data.size_mb} MB\nCollections: ${res.data.collections_backed_up}`);
        fetchBackups();
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Error creating backup");
    }
    setCreating(false);
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`Delete backup ${filename}?`)) return;
    
    try {
      await axios.delete(`${API}/admin/backup/${filename}`);
      fetchBackups();
    } catch (error) {
      alert("Error deleting backup");
    }
  };

  const restoreBackup = async (filename) => {
    if (!window.confirm(`⚠️ WARNING: This will OVERWRITE all current data with backup data.\n\nAre you sure you want to restore from ${filename}?`)) {
      return;
    }
    
    if (!window.confirm("This is your FINAL confirmation. All current data will be replaced. Continue?")) {
      return;
    }
    
    setRestoring(filename);
    try {
      const res = await axios.post(`${API}/admin/backup/restore/${filename}`, { confirm: true });
      if (res.data.success) {
        alert(`Database restored!\n\nRestored collections: ${res.data.restored_collections.join(", ")}`);
        fetchBackups();
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Error restoring backup");
    }
    setRestoring(null);
  };

  const totalSize = backups.reduce((acc, b) => acc + b.size_bytes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
              <Database className="w-6 h-6 text-blue-500" />
              <span>Database Backup & Recovery</span>
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Create, manage, and restore database backups
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchBackups}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={createBackup}
              disabled={creating}
              className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center space-x-2 hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span>{creating ? "Creating..." : "Create Backup Now"}</span>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-blue-800 text-sm">
              <strong>Automatic Weekly Backups:</strong> Backups are automatically created every Sunday at 2:00 AM (UTC).
              Only the last 4 weekly backups are retained to save storage.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{backups.length}</div>
          <div className="text-gray-500 text-sm">Total Backups</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">
            {(totalSize / (1024 * 1024)).toFixed(2)} MB
          </div>
          <div className="text-gray-500 text-sm">Total Size</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">
            {backups[0] ? new Date(backups[0].created_at).toLocaleDateString() : "N/A"}
          </div>
          <div className="text-gray-500 text-sm">Last Backup</div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Available Backups</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No backups found. Create your first backup!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {backups.map((backup) => (
              <div 
                key={backup.filename} 
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    backup.filename.includes('weekly') 
                      ? 'bg-purple-100 text-purple-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {backup.filename.includes('weekly') ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <HardDrive className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{backup.filename}</p>
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>{backup.size_mb} MB</span>
                      <span>•</span>
                      <span>{new Date(backup.created_at).toLocaleString()}</span>
                      {backup.filename.includes('weekly') && (
                        <>
                          <span>•</span>
                          <span className="text-purple-600">Auto Weekly</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => restoreBackup(backup.filename)}
                    disabled={restoring === backup.filename}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center space-x-1 text-sm disabled:opacity-50"
                  >
                    {restoring === backup.filename ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.filename)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <p className="text-amber-800 text-sm">
            <strong>Important:</strong> Restoring a backup will REPLACE all current data. 
            Create a new backup before restoring if you want to preserve current data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
