const map = L.map('map', {
  crs: L.CRS.EPSG4326,
}).setView([45, 15], 3);

const osm = L.tileLayer('https://osm-{s}.gs.mil/tiles/default_pc/{z}/{x}/{y}.png', {
  subdomains: '1234',
  attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong>',
});
osm.addTo(map);

try {
  L.geoPackageFeatureLayer([], {
    geoPackageUrl: 'https://ngageoint.github.io/GeoPackage/examples/rivers.gpkg',
    layerName: 'rivers',
    style: function(feature) {
      return {
        color: '#F00',
        weight: 2,
        opacity: 1,
      };
    },
    sqlJsWasmLocateFile: (filename) => 'vendor/dist/' + filename
  }).addTo(map);
} catch (e) {
  console.error(e);
}
