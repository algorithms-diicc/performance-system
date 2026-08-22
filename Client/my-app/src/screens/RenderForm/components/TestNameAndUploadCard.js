// src/screens/RenderForm/components/TestNameAndUploadCard.js
import React from "react";
import {
  FolderArchive,
  StickyNote,
  Tag,
  Upload,
} from "lucide-react";

import { useI18n } from "../../../i18n";
import {
  MAX_SUBMISSION_NOTE_CHARS,
  MAX_SUBMISSION_TITLE_CHARS,
} from "../formOnboardingModel";

function TestNameAndUploadCard({
  testName,
  onTestNameChange,
  note,
  onNoteChange,
  fileMeta,
  fileError,
  isDraggingFile,
  isInspectingZip,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
  fileInputRef,
  maxZipMb,
}) {
  const { t } = useI18n();
  const noteLength = String(note || "").length;

  const handleDropzoneKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  };

  return (
    <div className="rf-row rf-row-two">
      <section className="rf-panel">
        <label className="form-label" htmlFor="rf-test-name">
          <span className="label-icon" aria-hidden="true">
            <Tag />
          </span>
          {t("renderForm.upload.testNameLabel")}
        </label>
        <input
          id="rf-test-name"
          type="text"
          aria-label={t("renderForm.upload.testNameLabel")}
          value={testName}
          onChange={(e) => onTestNameChange(e.target.value)}
          maxLength={MAX_SUBMISSION_TITLE_CHARS}
          className="form-input"
          placeholder={t("renderForm.upload.testNamePlaceholder")}
        />
        <p className="form-help-text">
          {t("renderForm.upload.testNameHelp")}
        </p>

        <div className="rf-note-field">
          <label className="form-label" htmlFor="rf-submission-note">
            <span className="label-icon" aria-hidden="true">
              <StickyNote />
            </span>
            {t("renderForm.upload.noteLabel")}{" "}
            <span className="rf-note-optional">
              {t("renderForm.upload.optional")}
            </span>
          </label>
          <textarea
            id="rf-submission-note"
            className="form-input rf-note-textarea"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={MAX_SUBMISSION_NOTE_CHARS}
            aria-describedby="rf-submission-note-help rf-submission-note-counter"
          />
          <div className="rf-note-meta">
            <p
              id="rf-submission-note-help"
              className="form-help-text"
            >
              {t("renderForm.upload.notePrivate")}
            </p>
            <span
              id="rf-submission-note-counter"
              className="rf-note-counter"
              aria-live="polite"
            >
              {t("renderForm.upload.characters", {
                count: noteLength,
                max: MAX_SUBMISSION_NOTE_CHARS,
              })}
            </span>
          </div>
        </div>
      </section>

      <section className="rf-panel">
        <label className="form-label" htmlFor="rf-code-archive">
          <span className="label-icon" aria-hidden="true">
            <FolderArchive />
          </span>
          {t("renderForm.upload.archiveLabel")}
        </label>

        <div
          className={`file-upload-dropzone ${
            isDraggingFile ? "dragging" : ""
          } ${fileError ? "has-error" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={0}
          aria-label={t("renderForm.upload.selectAria")}
        >
          <div className="file-upload-content">
            <div className="file-upload-icon" aria-hidden="true">
              <Upload />
            </div>
            <div className="file-upload-text">
              <span className="file-upload-title">
                {t("renderForm.upload.dropTitle")}
              </span>
              <span className="file-upload-hint">
                {t("renderForm.upload.dropHint")}
              </span>
              <span className="file-upload-hint">
                {t("renderForm.upload.maxHint", {
                  max: maxZipMb,
                })}
              </span>
            </div>
          </div>

          {fileMeta && (
            <div className="file-meta">
              <div className="file-meta-name">{fileMeta.name}</div>
              <div className="file-meta-extra">
                <span>{fileMeta.sizeLabel}</span>
                {isInspectingZip && (
                  <span>
                    · {t("renderForm.upload.inspecting")}
                  </span>
                )}
                {!isInspectingZip && (
                  <span>
                    ·{" "}
                    {t("renderForm.upload.cppFiles", {
                      count: fileMeta.cppCount,
                    })}
                  </span>
                )}
              </div>
              {!isInspectingZip &&
                fileMeta.cppSample &&
                fileMeta.cppSample.length > 0 && (
                  <div className="file-meta-extra">
                    <span>
                      {t("renderForm.upload.examplesInside")}
                    </span>
                    <span>
                      {fileMeta.cppSample.join(" · ")}
                      {fileMeta.cppCount > fileMeta.cppSample.length
                        ? " · …"
                        : ""}
                    </span>
                  </div>
                )}
            </div>
          )}

          <input
            id="rf-code-archive"
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={onFileInputChange}
            className="file-input-hidden"
          />
        </div>

        {fileError && (
          <p className="form-error-text">
            {fileError}
          </p>
        )}
      </section>
    </div>
  );
}

export default TestNameAndUploadCard;
