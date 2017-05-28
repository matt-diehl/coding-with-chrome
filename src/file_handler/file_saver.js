/**
 * @fileoverview File saver for the file handler.
 *
 * @license Copyright 2015 The Coding with Chrome Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author mbordihn@google.com (Markus Bordihn)
 */
goog.provide('cwc.fileHandler.FileSaver');

goog.require('cwc.file.MimeType');


/**
 * @param {!cwc.utils.Helper} helper
 * @constructor
 * @struct
 * @final
 */
cwc.fileHandler.FileSaver = function(helper) {
  /** @type {string} */
  this.name = 'FileSaver';

  /** @type {string} */
  this.fileData = '';

  /** @type {string} */
  this.filename = '';

  /** @type {string} */
  this.fileType = '';

  /** @type {Object} */
  this.fileHandler = null;

  /** @type {string} */
  this.gDriveId = '';

  /** @type {cwc.utils.Helper} */
  this.helper = helper;
};


/**
 * @param {boolean=} autoDetect Auto detect where to save the file.
 * @export
 */
cwc.fileHandler.FileSaver.prototype.saveFile = function(autoDetect = false) {
  console.log('saveFile...');
  this.prepareContent();
  if (autoDetect && this.gDriveId) {
    this.saveGDriveFile(true);
  } else if (this.fileHandler) {
    this.prepareSaveFile(this.fileHandler, this.filename, this.fileData);
  } else {
    this.selectFileToSave(this.filename, this.fileData);
  }
};


/**
 * @export
 */
cwc.fileHandler.FileSaver.prototype.saveFileAs = function() {
  console.log('saveFileAs...');
  this.prepareContent();
  this.selectFileToSave(this.filename, this.fileData);
};


/**
 * @param {boolean=} save_file If true save file, otherwise open 'save as'
 *   file dialog.
 * @export
 */
cwc.fileHandler.FileSaver.prototype.saveGDriveFile = function(save_file) {
  console.log('Save file in Google Drive', this.gDriveId);
  let gDriveInstance = this.helper.getInstance('gdrive', true);
  this.prepareContent();
  if (save_file) {
    gDriveInstance.saveFile(this.filename, this.fileData, this.gDriveId);
  } else {
    gDriveInstance.saveDialog(this.filename, this.fileData, this.gDriveId);
  }
};


/**
 * @export
 */
cwc.fileHandler.FileSaver.prototype.saveGCloudFile = function() {
  console.log('Save file in Google Cloud');
  let gCloudInstance = this.helper.getInstance('gcloud', true);
  this.prepareContent();
  gCloudInstance.publishDialog(this.filename, this.fileData, this.fileType);
};


/**
 * Prepares file and ensures we have the latest editor content.
 */
cwc.fileHandler.FileSaver.prototype.prepareContent = function() {
  let editorInstance = this.helper.getInstance('editor', true);
  let fileInstance = this.helper.getInstance('file', true);
  let fileHandler = fileInstance.getFileHandler();
  let fileTitle = fileInstance.getFileTitle();
  let filename = fileInstance.getFilename();
  let gDriveId = fileInstance.getGDriveId();
  let mimeType = fileInstance.getMimeType();

  // Handle CWC file format
  if (mimeType.type === cwc.file.MimeType.CWC.type) {
    let file = fileInstance.getFile();

    let blocklyInstance = this.helper.getInstance('blockly');
    if (blocklyInstance) {
      let viewName = blocklyInstance.getViewName();
      if (viewName) {
        file.setContent(viewName, blocklyInstance.getXML());
      }
    }

    let editorInstance = this.helper.getInstance('editor');
    if (editorInstance) {
      let views = editorInstance.getViews();
      for (let entry in views) {
        if (Object.prototype.hasOwnProperty.call(views, entry)) {
          file.setContent(entry, views[entry].getContent());
        }
      }
    }

    this.fileData = file.getJSON();
    this.filename = this.addFileExtension(filename || fileTitle || 'untitled');

  // Handle raw file format
  } else {
    this.fileData = editorInstance.getEditorContent('__default__');
    this.filename = this.addFileExtension(
      filename || 'unnamed', mimeType.ext[0]);
  }

  this.fileType = mimeType.type;
  this.fileHandler = fileHandler;
  this.gDriveId = gDriveId;
};


/**
 * @param {!string} filename
 * @param {string=} extension
 * @return {!string}
 */
cwc.fileHandler.FileSaver.prototype.addFileExtension = function(
    filename, extension = cwc.file.MimeType.CWC.ext[0]) {
  if (filename.includes(extension)) {
    return filename;
  }
  return filename + extension;
};


/**
 * @param {!string} name
 * @param {!string} content
 */
cwc.fileHandler.FileSaver.prototype.selectFileToSave = function(name, content) {
  let prepareSaveFile = function(file_entry, opt_file_entries) {
    if (chrome.runtime.lastError) {
      console.error('Choose Entry error for', name, ':',
        chrome.runtime.lastError);
    } else if (file_entry) {
      this.prepareSaveFile(file_entry, name, content);
    } else {
      console.error('Was unable to choose file entry to save.');
    }
  }.bind(this);
  console.log('Select file to save content for', name);
  chrome.fileSystem.chooseEntry({
    'type': 'saveFile',
    'suggestedName': this.getSafeFilename_(name),
  }, prepareSaveFile);
};


/**
 * @param {Object} file_entry
 * @param {!string} name
 * @param {!string} content
 */
cwc.fileHandler.FileSaver.prototype.prepareSaveFile = function(
    file_entry, name, content) {
  if (!file_entry) {
    console.log('No file was selected for', name, file_entry);
    return;
  }

  console.log('Prepare fileWriter for', name);
  let fileWriter = this.fileWriterHandler.bind(this);
  file_entry.createWriter(function(writer) {
    fileWriter(writer, name, content, file_entry);
  });
};


/**
 * Saves a file.
 * @param {Object} writer
 * @param {!string} name
 * @param {!string} content
 * @param {Object} file_entry
 */
cwc.fileHandler.FileSaver.prototype.fileWriterHandler = function(
    writer, name, content, file_entry) {
  let fileInstance = this.helper.getInstance('file', true);
  let filename = file_entry['name'] || name;
  let blobContent = new Blob([content]);
  let truncated = false;
  let helperInstance = this.helper;
  console.log('Writing file', filename, 'with file-size', blobContent['size'],
      ':', content);
  writer.onwriteend = function(opt_event) {
    if (!truncated) {
      this.truncate(this.position);
      truncated = true;
      return;
    }
    fileInstance.setFileHandler(file_entry);
    fileInstance.setUnsavedChange(false);
    helperInstance.showSuccess('Saved file ' + filename + ' successful.');
  };
  writer.onerror = function(opt_event) {
    this.helper.showError('Unable to save file ' + filename + '!');
  };
  writer.seek(0);
  writer.write(blobContent, {'type': 'text/plain'});
};


/**
 * Returns and OS safe filename.
 * @param {!string} name
 * @return {!string}
 * @private
 */
cwc.fileHandler.FileSaver.prototype.getSafeFilename_ = function(name) {
  return name
    .replace(':', '-')
    .replace('/', '_')
    .replace('>', '[')
    .replace('<', ']')
    .replace('*', 'x')
    .replace('|', ',')
    .replace('\\0', '')
    .replace('\\', '');
};
