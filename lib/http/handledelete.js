/**
 * (c) Copyright 2015 Hewlett-Packard Development Company, L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var pronto = require('pronto');

/**
 * Delete a Resource.
 *
 * Params:
 * - resourceBridge: the bridge. (REQUIRED)
 * - resource: the resource to delete (OPTIONAL). If none is
 *   given, a 404 will be returned. Otherwise, this tries to
 *   return a 204 or a 207 (on errors for deletion of a collection)
 */
function HandleDelete () {
}
pronto.inheritsCommand(HandleDelete);
module.exports = HandleDelete;

HandleDelete.prototype.execute = function (cxt, params) {
  this.required(params, ['resourceBridge']);
  var bridge = params.resourceBridge;
  var resource = params.resource;

  if (!resource) {
    //this.done(404)
    this.reroute('@404', cxt);
    return;
  }

  // Deleting a URL with a fragment causes Litmus to complain.
  var req = cxt.getDatasource('request');
  if (req.parsedUrl.hash) {
    cxt.log('URL has a fragment. Refusing to delete.', 'warning');
    cxt.add('body', 'Cannot delete a URL with a fragment.');
    this.reroute('@409', cxt);
    return;
  }

  var cmd =  this;

  // Delete a collection.
  if (resource.isCollection) {
    cxt.log('Deleting collection ' + resource.name(), 'debug');
    bridge.deleteCollection(resource, function (e, multistatus) {
      if (e) {
        var stat = e.status || 500;
        cxt.log('Failed to delete collection: %s', e.message, 'debug');
        cmd.reroute('@' + stat, cxt);
      }
      else if (multistatus.length > 0) {
        cxt.add('multistatus', cmd.generateMultistatus(multistatus));
        cmd.done(207);
      }
      else {
        // If there are no errors we can return a 204.
        cmd.done(204);
      }
      return;
    });
  }
  // Delete a file.
  else {
    cxt.log('Deleting file ' + resource.name(), 'debug');
    bridge.deleteFile(resource, function (e) {
      // Reroute to an error handler.
      if (e) {
        var status = e.status || 500;
        cxt.add('body', 'No files deleted.');
        cmd.reroute('@' + status, cxt);
        return;
      }

      // No content for a standard delete.
      cmd.done(204);
      return;
    });
  }
}

/**
 * Generate a multistatus for errors.
 *
 * @param {Array} messages
 *   An array of messages with msg.href and msg.status defined for each
 *   element.
 * @return {DOMDocument}
 *   An XML DOM document.
 */
HandleDelete.prototype.generateMultistatus = function (messages) {
  var MultiStatus = require('./multistatus');
  var ms = new MultiStatus();

  for (var i = 0; i < messages.length; ++i) {
    var msg = messages[i];
    ms.addStatus(msg.href, msg.status);
  }

  return ms.toXML();
}
