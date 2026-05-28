import React, { useRef, useState } from "react";
import { UserNode } from "../model/user";
import { exportWhitelist, importWhitelist, clearWhitelist, mergeWhitelists } from "../utils/whitelist-manager";
import { useConfirm } from "./ui/ConfirmDialog";

interface WhitelistManagerProps {
  whitelistedUsers: readonly UserNode[];
  onWhitelistUpdate: (users: readonly UserNode[]) => void;
}

const DownloadIcon = () => (
  <svg className="whitelist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

const UploadIcon = () => (
  <svg className="whitelist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 17V5" />
    <path d="m7 10 5-5 5 5" />
    <path d="M5 21h14" />
  </svg>
);

const TrashIcon = () => (
  <svg className="whitelist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

const InfoIcon = () => (
  <svg className="whitelist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01" />
    <path d="M11 12h1v5h1" />
  </svg>
);

export const WhitelistManager = ({ whitelistedUsers, onWhitelistUpdate }: WhitelistManagerProps) => {
  const askConfirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleExport = () => {
    exportWhitelist(whitelistedUsers);
    setMessage({ type: "success", text: `Exported ${whitelistedUsers.length} users successfully` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    importWhitelist(
      file,
      (importedUsers) => {
        let finalUsers: readonly UserNode[];
        
        if (importMode === "merge") {
          finalUsers = mergeWhitelists(whitelistedUsers, importedUsers);
          const newUsersCount = finalUsers.length - whitelistedUsers.length;
          setMessage({ 
            type: "success", 
            text: `Merged successfully! Added ${newUsersCount} new users (${importedUsers.length} imported, ${importedUsers.length - newUsersCount} duplicates skipped)` 
          });
        } else {
          finalUsers = importedUsers;
          setMessage({ 
            type: "success", 
            text: `Replaced whitelist with ${importedUsers.length} users` 
          });
        }
        
        onWhitelistUpdate(finalUsers);
        setTimeout(() => setMessage(null), 5000);
      },
      (errorMessage) => {
        setMessage({ type: "error", text: errorMessage });
        setTimeout(() => setMessage(null), 5000);
      }
    );

    // Reset file input
    event.currentTarget.value = "";
  };

  const handleClear = async () => {
    const ok = await askConfirm({
      title: 'Clear whitelist?',
      message: 'This will remove every user from your whitelist. This action cannot be undone.',
      confirmLabel: 'Clear',
    });
    if (!ok) {
      return;
    }
    clearWhitelist();
    onWhitelistUpdate([]);
    setMessage({ type: "success", text: "Whitelist cleared successfully" });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="whitelist-manager">
      <div className="whitelist-header">
        <h4>Whitelist Management</h4>
        <span className="whitelist-count">
          {whitelistedUsers.length} {whitelistedUsers.length === 1 ? "user" : "users"}
        </span>
      </div>

      {message && (
        <div className={`whitelist-message ${message.type === "error" ? "error" : "success"}`}>
          {message.text}
        </div>
      )}

      <div className="whitelist-actions">
        <button 
          className="btn btn-export" 
          onClick={handleExport}
          disabled={whitelistedUsers.length === 0}
          title={whitelistedUsers.length === 0 ? "No users to export" : "Export whitelist to JSON file"}
        >
          <DownloadIcon />Export whitelist
        </button>

        <div className="import-section">
          <div className="import-mode">
            <label>
              <input
                type="radio"
                name="importMode"
                value="merge"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
              />
              Merge (add to existing)
            </label>
            <label>
              <input
                type="radio"
                name="importMode"
                value="replace"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
              />
              Replace (overwrite)
            </label>
          </div>

          <button 
            className="btn btn-import" 
            onClick={handleImportClick}
            title="Import whitelist from JSON file"
          >
            <UploadIcon />Import whitelist
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        <button 
          className="btn btn-clear" 
          onClick={handleClear}
          disabled={whitelistedUsers.length === 0}
          title={whitelistedUsers.length === 0 ? "Whitelist is empty" : "Clear all whitelist data"}
        >
          <TrashIcon />Clear whitelist
        </button>
      </div>

      <div className="whitelist-info">
        <p className="info-text">
          <InfoIcon /><strong>Tip:</strong>&nbsp;Export your whitelist as a JSON backup, then re-import later to restore the same set of users.
        </p>
      </div>
    </div>
  );
};
