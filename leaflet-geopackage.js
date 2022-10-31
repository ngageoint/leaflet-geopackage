const { GeoPackageAPI, setSqljsWasmLocateFile } = require('@ngageoint/geopackage');

const geoPackageCache = {};

function maybeDrawTile(gridLayer, tilePoint, canvas, done) {
  const geoPackage = gridLayer.geoPackage;
  const layerName = gridLayer.options.layerName;
  const map = gridLayer._map;
  if (!geoPackage) {
    // not loaded yet, just wait
    setTimeout(maybeDrawTile, 250, gridLayer, tilePoint, canvas, done);
    return;
  }
  setTimeout(function() {
    if (map.options.crs === L.CRS.EPSG4326) {
      const tileSize = gridLayer.getTileSize(),
        nwPoint = tilePoint.scaleBy(tileSize),
        sePoint = nwPoint.add(tileSize),
        nw = map.unproject(nwPoint, tilePoint.z),
        se = map.unproject(sePoint, tilePoint.z);
      geoPackage
        .projectedTile(
          layerName,
          se.lat,
          nw.lng,
          nw.lat,
          se.lng,
          tilePoint.z,
          'EPSG:4326',
          canvas.width,
          canvas.height,
          canvas,
        )
        .then(function() {
          done(null, canvas);
        });
    } else {
      geoPackage
        .xyzTile(layerName, tilePoint.x, tilePoint.y, tilePoint.z, canvas.width, canvas.height, canvas)
        .then(function() {
          done(null, canvas);
        });
    }
  }, 0);
}

L.GeoPackageTileLayer = L.GridLayer.extend({
  options: {
    layerName: '',
    geoPackageUrl: '',
    geoPackage: undefined,
    noCache: false,
    sqlJsWasmLocateFile: filename => 'https://unpkg.com/@ngageoint/geopackage@4.2.3/dist/' + filename,
  },
  initialize: function initialize(options) {
    L.GridLayer.prototype.initialize.call(this, L.setOptions(this, options));
    setSqljsWasmLocateFile(options.sqlJsWasmLocateFile || (filename => 'https://unpkg.com/@ngageoint/geopackage@4.2.3/dist/' + filename));
  },
  onAdd: function onAdd(map) {
    L.GridLayer.prototype.onAdd.call(this, map);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const layer = this;

    if (layer.options.geoPackage) {
      layer.geoPackage = layer.options.geoPackage;
      layer.geoPackageLoaded = true;
      return;
    }

    if (!layer.options.noCache && geoPackageCache[layer.options.geoPackageUrl]) {
      layer.geoPackageLoaded = true;
      layer.geoPackage = geoPackageCache[layer.options.geoPackageUrl];
      return;
    }

    layer.geoPackageLoaded = false;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.options.geoPackageUrl, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(e) {
      const uInt8Array = new Uint8Array(this.response);
      GeoPackageAPI.open(uInt8Array).then(function(gp) {
        layer.geoPackageLoaded = true;
        layer.geoPackage = gp;
        geoPackageCache[layer.options.geoPackageUrl] = layer.options.noCache || gp;
      });
    };
    xhr.send();
  },
  onRemove: function onRemove(map) {
    L.GridLayer.prototype.onRemove.call(this, map);
  },
  createTile: function(tilePoint, done) {
    const canvas = L.DomUtil.create('canvas', 'leaflet-tile');
    const size = this.getTileSize();
    canvas.width = size.x;
    canvas.height = size.y;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    maybeDrawTile(this, tilePoint, canvas, done);
    return canvas;
  },
});

L.geoPackageTileLayer = function(opts) {
  return new L.GeoPackageTileLayer(opts);
};

let setup = false;
/**
 * Sets up css for the popup
 */
function setupCSS () {
  if (!setup) {
    setup = true;
    const css = '.leaflet-geopackage-popup {' +
        '    max-width: 400px !important;' +
        '    max-height: 250px !important;' +
        '    background: white !important;' +
        '    border-radius: 8px !important;' +
        '    overflow: hidden;' +
        '}' +
        '.leaflet-geopackage-image {' +
        '    overflow: none !important;' +
        '    width: 400px !important;' +
        '    height: 150px !important;' +
        '}' +
        '.leaflet-geopackage-info {' +
        '    margin-left: 12px !important;' +
        '    margin-right: 12px !important;' +
        '    margin-bottom: 12px !important;' +
        '    overflow-y: auto;' +
        '    max-height: 88px !important;' +
        '    max-width: 388px !important;' +
        '}' +
        '.leaflet-geopackage-break-word {' +
        '    word-break: break-word !important;' +
        '}' +
        '.leaflet-popup-content {' +
        '    background: transparent !important;' +
        '    margin: -4px -4px 0px -4px !important;' +
        '    border-radius: 8px !important;' +
        '}' +
        '.fill {' +
        '    display: flex;' +
        '    justify-content: center;' +
        '    align-items: center;' +
        '    overflow: hidden' +
        '}' +
        '.fill img {' +
        '    flex-shrink: 0;' +
        '    min-width: 100%;' +
        '    min-height: 100%' +
        '}',
    head = document.head || document.getElementsByTagName('head')[0],
    style = document.createElement('style');
    head.appendChild(style);
    style.type = 'text/css';
    if (style.styleSheet){
      // This is required for IE8 and below.
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }
}

/**
 * Generates a simple table element
 * @param feature
 */
function generateSimpleTable(feature) {
  let tableBuilder = [];
  tableBuilder.push('<table>');
  tableBuilder.push('<tbody>');
  Object.keys(feature.properties)
    .filter(key => key !== 'id' && key !== '_feature_id' && feature.properties[key] != null)
    .forEach(key => tableBuilder.push('<tr><td><b>' + key + '&nbsp;</b></td><td><span class="leaflet-geopackage-break-word">' + feature.properties[key] + '</span></td></tr>'));
  tableBuilder.push('</tbody>');
  tableBuilder.push('</table>');
  return tableBuilder.join('');
}

/**
 * Display an image associated
 * @param image
 * @returns {string}
 */
function generateImage(image) {
  return '<div class="leaflet-geopackage-image fill"><img src="' + image.src + '" alt=""/></div>';
}

/**
 * Gets the media object url from a media row
 * @param media
 * @returns {{src: null, type: string}}
 */
function getMediaObjectURL (media) {
  let result = {
    src: null,
    type: 'text/html'
  };
  let blob = null;
  if (media) {
    blob = new Blob([media.data], { type: media.contentType })
    result.type = media.contentType
    result.src = URL.createObjectURL(blob)
  }
  return result;
}

/**
 * Get Images for a feature
 * @param geoPackage
 * @param tableName
 * @param featureId
 */
function getImagesForFeature(geoPackage, tableName, featureId) {
  // get media relations for this feature table
  const images = [];
  const rte = geoPackage.relatedTablesExtension;
  const typeFilter = [
    'image/png',
    'image/jpg',
    'image/jpeg',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
  ];
  if (rte.has()) {
    const featureDao = geoPackage.getFeatureDao(tableName);
    const mediaRelations = featureDao.mediaRelations;
    for (let i = 0; i < mediaRelations.length; i++) {
      const mediaRelation = mediaRelations[i];
      if (mediaRelation.mapping_table_name !== 'nga_icon_' + tableName) {
        const userMappingDao = rte.getMappingDao(mediaRelation.mapping_table_name);
        // query for all mappings for this feature id
        const mappings = userMappingDao.queryByBaseId(featureId)
        for (let m = 0; m < mappings.length; m++) {
          const mediaDao = rte.getMediaDao(mediaRelation.related_table_name)
          const media = mediaDao.queryForId(mappings[m].related_id)
          if (media != null && typeFilter.indexOf(media.contentType) !== -1) {
            images.push(getMediaObjectURL(media));
          }
        }
      }
    }
  }
  return images;
}

L.GeoPackageFeatureLayer = L.GeoJSON.extend({
  showPopupForFeature: function(feature, layer) {
    const images = getImagesForFeature(this.geoPackage, this.layerName, feature.id);
    const html = ['<div class="leaflet-geopackage-popup">'];
    if (images.length > 0) {
      html.push(generateImage(images[0]));
    }
    html.push('<div class="leaflet-geopackage-info">')
    html.push('<span><b><h3>' + this.options.layerName + ' </h3></b></span>')
    html.push(generateSimpleTable(feature));
    html.push('</div>');
    html.push('</div>');
    layer.bindPopup(html.join(''), {
      maxWidth: 400,
      maxHeight: 300,
      width: 100
    });
  },
  options: {
    layerName: '',
    geoPackageUrl: '',
    geoPackage: undefined,
    noCache: false,
    propertiesToIgnore: [],
    style: function() {
      return {
        color: '#00F',
        weight: 2,
        opacity: 1,
      };
    },
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 2,
      });
    },
    onEachFeature: function (feature, layer) {
      layer.on({
        click: () => feature.generatePopup(layer)
      })
    },
    sqlJsWasmLocateFile: filename => 'https://unpkg.com/@ngageoint/geopackage@4.2.3/dist/' + filename,
  },
  initialize: function initialize(data, options) {
    L.GeoJSON.prototype.initialize.call(this, data, L.setOptions(this, options));
    setSqljsWasmLocateFile(options.sqlJsWasmLocateFile || (filename => 'https://unpkg.com/@ngageoint/geopackage@4.2.3/dist/' + filename));
  },
  onAdd: function onAdd(map) {
    setupCSS();
    L.GeoJSON.prototype.onAdd.call(this, map);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const layer = this;
    if (layer.options.geoPackage) {
      layer.geoPackage = layer.options.geoPackage;
      layer.geoPackageLoaded = true;
      const results = layer.geoPackage.iterateGeoJSONFeatures(layer.options.layerName);
      for (let geoJson of results) {
        geoJson = {
          type: 'Feature',
          geometry: geoJson.geometry,
          id: geoJson.id,
          properties: geoJson.properties,
        };
        layer.addData(geoJson);
      }
      return;
    }
    if (!layer.options.noCache && geoPackageCache[layer.options.geoPackageUrl]) {
      layer.geoPackageLoaded = true;
      layer.geoPackage = geoPackageCache[layer.options.geoPackageUrl];
      const results = layer.geoPackage.iterateGeoJSONFeatures(layer.options.layerName);
      for (let geoJson of results) {
        geoJson = {
          type: 'Feature',
          geometry: geoJson.geometry,
          id: geoJson.id,
          properties: geoJson.properties,
        };
        layer.addData(geoJson);
      }
      return;
    }
    layer.geoPackageLoaded = false;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.options.geoPackageUrl, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      GeoPackageAPI.open(new Uint8Array(this.response)).then(function(gp) {
        layer.geoPackageLoaded = true;
        layer.geoPackage = gp;
        layer.layerName = layer.options.layerName;
        geoPackageCache[layer.options.geoPackageUrl] = layer.options.noCache || gp;
        const results = layer.geoPackage.iterateGeoJSONFeatures(layer.options.layerName);
        for (let geoJson of results) {
          geoJson = {
            type: 'Feature',
            geometry: geoJson.geometry,
            id: geoJson.id,
            properties: geoJson.properties,
            generatePopup: (l) => {
              layer.showPopupForFeature(geoJson, l);
            }
          };
          layer.addData(geoJson);
        }
      });
    };
    xhr.send();
  },
});

L.geoPackageFeatureLayer = function(data, opts) {
  return new L.GeoPackageFeatureLayer(data, opts);
};
