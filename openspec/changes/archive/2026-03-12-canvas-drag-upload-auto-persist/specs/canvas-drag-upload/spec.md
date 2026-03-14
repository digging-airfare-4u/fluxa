## ADDED Requirements

### Requirement: Canvas SHALL accept local image file drops for single and multiple files
The system SHALL detect local image files dropped onto the canvas surface and process both single-file and multi-file drops in one interaction.

#### Scenario: Single image file is dropped
- **WHEN** a user drops one local image file onto the canvas
- **THEN** the system starts drop processing for that file using the drop position as insertion anchor

#### Scenario: Multiple image files are dropped
- **WHEN** a user drops multiple local image files onto the canvas
- **THEN** the system starts drop processing for each valid image file without requiring separate user actions

### Requirement: System SHALL provide per-file loading placeholders during drop processing
The system SHALL create a loading placeholder for each dropped image immediately after drop handling begins and SHALL remove that placeholder when the corresponding file either succeeds or fails.

#### Scenario: Placeholder appears immediately for each file
- **WHEN** dropped files are accepted for processing
- **THEN** the system renders one loading placeholder per file near computed canvas placement coordinates

#### Scenario: Placeholder is removed after success
- **WHEN** one dropped file uploads successfully and is inserted to canvas
- **THEN** the system removes only that file's loading placeholder

#### Scenario: Placeholder is removed after failure
- **WHEN** one dropped file fails validation, compression, upload, or insertion
- **THEN** the system removes only that file's loading placeholder

### Requirement: System SHALL upload dropped images to persistent storage and register asset metadata
For each accepted dropped image file, the system SHALL upload the file content to persistent storage and SHALL create an `assets` record associated with the current user and project.

#### Scenario: Upload and asset registration succeed
- **WHEN** a valid dropped image passes processing and upload
- **THEN** the system stores the image in persistent storage pathing compatible with existing asset conventions
- **AND THEN** the system creates an `assets` row with `type` set to `upload` and source metadata indicating `user_upload`

### Requirement: System SHALL apply conditional compression only when thresholds are exceeded
The system SHALL compress dropped image files only when environment-configurable file-size or dimension thresholds are exceeded (with required default values), and SHALL otherwise upload original file content.

#### Scenario: File does not exceed thresholds
- **WHEN** a dropped image is within configured size and dimension thresholds
- **THEN** the system uploads the original file without compression

#### Scenario: File exceeds thresholds
- **WHEN** a dropped image exceeds configured size or dimension thresholds
- **THEN** the system performs client-side compression before upload

### Requirement: Canvas insertion SHALL use unified ops persistence
The system SHALL insert uploaded dropped images into canvas through the existing unified image persistence path so that resulting images are replayable and durable.

#### Scenario: Insert dropped image through persistent op flow
- **WHEN** dropped image upload returns a usable image URL
- **THEN** the system inserts the image via the unified image persistence mechanism
- **AND THEN** the resulting op is persisted so the image remains after reload/replay

### Requirement: Drop pipeline SHALL handle invalid and failed files without aborting all files
The system SHALL skip unsupported files, continue processing remaining files in the same drop batch, and provide failure feedback for rejected files.

#### Scenario: Drop contains mixed valid and invalid files
- **WHEN** a user drops files where at least one file is not a supported image type
- **THEN** the system skips unsupported files and continues processing supported image files

#### Scenario: One file fails while others succeed
- **WHEN** one file in a multi-file drop fails during processing
- **THEN** the system reports that file's failure and continues processing other files in the same drop batch