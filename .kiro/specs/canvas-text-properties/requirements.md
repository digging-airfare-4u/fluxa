# Requirements Document

## Introduction

本功能为 Canvas 上的文字图层添加属性编辑面板，用户可以在选中文字后修改字体、颜色、大小、对齐方式等样式属性。

## Glossary

- **Text_Layer**: Canvas 上的 Fabric.js IText 对象
- **Properties_Panel**: 显示和编辑选中对象属性的 UI 面板
- **Text_Properties**: 文字的样式属性，包括字体、颜色、大小等
- **Color_Picker**: 颜色选择器组件
- **Font_Selector**: 字体选择下拉框

## Requirements

### Requirement 1: 文字属性面板显示

**User Story:** As a user, I want to see a properties panel when I select a text layer, so that I can edit its style.

#### Acceptance Criteria

1. WHEN a user selects a Text_Layer on the canvas, THE System SHALL display the Properties_Panel
2. WHEN a user selects a non-text object, THE System SHALL hide the text-specific properties
3. WHEN no object is selected, THE System SHALL hide the Properties_Panel
4. THE Properties_Panel SHALL be positioned on the right side of the editor
5. THE Properties_Panel SHALL not overlap with the ChatPanel

### Requirement 2: 字体选择

**User Story:** As a user, I want to change the font of my text, so that I can match my design style.

#### Acceptance Criteria

1. THE Properties_Panel SHALL display a Font_Selector dropdown
2. THE Font_Selector SHALL include common fonts: Inter, Arial, Helvetica, Times New Roman, Georgia, Courier New, Comic Sans MS
3. WHEN a user selects a font, THE System SHALL update the Text_Layer's fontFamily property
4. THE Font_Selector SHALL show the current font of the selected Text_Layer
5. WHEN the font changes, THE System SHALL persist the change via updateLayer op

### Requirement 3: 字号调整

**User Story:** As a user, I want to change the font size, so that I can control text prominence.

#### Acceptance Criteria

1. THE Properties_Panel SHALL display a font size input field
2. THE font size input SHALL accept values from 8 to 200
3. WHEN a user changes the font size, THE System SHALL update the Text_Layer's fontSize property
4. THE System SHALL provide preset size buttons: 12, 16, 24, 32, 48, 64, 72
5. WHEN the font size changes, THE System SHALL persist the change via updateLayer op

### Requirement 4: 文字颜色

**User Story:** As a user, I want to change the text color, so that I can create visually appealing designs.

#### Acceptance Criteria

1. THE Properties_Panel SHALL display a Color_Picker for text fill color
2. THE Color_Picker SHALL support hex color input
3. THE Color_Picker SHALL provide preset colors: black, white, red, blue, green, yellow, purple, orange
4. WHEN a user selects a color, THE System SHALL update the Text_Layer's fill property
5. THE Color_Picker SHALL show the current color of the selected Text_Layer

### Requirement 5: 文字样式

**User Story:** As a user, I want to apply bold, italic, and underline styles, so that I can emphasize text.

#### Acceptance Criteria

1. THE Properties_Panel SHALL display toggle buttons for Bold, Italic, Underline, and Strikethrough
2. WHEN a user clicks Bold, THE System SHALL toggle the Text_Layer's fontWeight between 'normal' and 'bold'
3. WHEN a user clicks Italic, THE System SHALL toggle the Text_Layer's fontStyle between 'normal' and 'italic'
4. WHEN a user clicks Underline, THE System SHALL toggle the Text_Layer's underline property
5. WHEN a user clicks Strikethrough, THE System SHALL toggle the Text_Layer's linethrough property
6. THE toggle buttons SHALL reflect the current state of the selected Text_Layer

### Requirement 6: 文字对齐

**User Story:** As a user, I want to align my text, so that I can control text layout.

#### Acceptance Criteria

1. THE Properties_Panel SHALL display alignment buttons: Left, Center, Right
2. WHEN a user clicks an alignment button, THE System SHALL update the Text_Layer's textAlign property
3. THE alignment buttons SHALL indicate the current alignment of the selected Text_Layer
4. THE System SHALL persist alignment changes via updateLayer op

### Requirement 7: 实时预览

**User Story:** As a user, I want to see changes immediately on the canvas, so that I can iterate quickly.

#### Acceptance Criteria

1. WHEN any text property changes, THE Canvas SHALL update immediately without delay
2. THE System SHALL debounce persistence to avoid excessive database writes
3. IF a property change fails validation, THEN THE System SHALL revert to the previous value
4. THE System SHALL maintain undo/redo support for all property changes

### Requirement 8: 快捷键支持

**User Story:** As a user, I want to use keyboard shortcuts for common text operations, so that I can work faster.

#### Acceptance Criteria

1. WHEN a Text_Layer is selected and user presses Cmd/Ctrl+B, THE System SHALL toggle bold
2. WHEN a Text_Layer is selected and user presses Cmd/Ctrl+I, THE System SHALL toggle italic
3. WHEN a Text_Layer is selected and user presses Cmd/Ctrl+U, THE System SHALL toggle underline
4. THE shortcuts SHALL only work when a Text_Layer is selected and not in editing mode
