import 'ol/ol.css';
import Graticule from 'ol/layer/Graticule';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import Stamen from 'ol/source/Stamen';
import Stroke from 'ol/style/Stroke';
import TileImage from 'ol/source/TileImage';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import proj4 from 'proj4';
import { applyTransform } from 'ol/extent';
import { get as getProjection, getTransform } from 'ol/proj';
import { register } from 'ol/proj/proj4';

const graticule = new Graticule({
  // the style to use for the lines, optional.
  strokeStyle: new Stroke({
    color: 'rgba(0,0,0,0.7)',
    // color: 'rgba(0,255,255,0.7)',
    width: 1,
    // width: 4,
    // lineDash: [7, 3],
    // lineDash: [0.5, 4],
    lineCap: 'butt',
  }),
  /* strokeStyle: new Stroke({
    color: 'rgba(255,120,0,0.9)',
    width: 2,
    lineDash: [0.5, 4],
  }), */
  showLabels: true,
  visible: false,
  wrapX: false,
});

const graticule2 = new Graticule({
  // the style to use for the lines, optional.
  strokeStyle: new Stroke({
    color: 'rgba(255,255,255,0.7)',
    // color: 'rgba(0,0,0,0.7)',
    width: 4,
    lineCap: 'butt',
  }),
  showLabels: false,
  visible: false,
  wrapX: false,
});
// const graticule2 = undefined;

const osmLayer = new TileLayer({
  source: new OSM(),
});
const stamen1 = new TileLayer({
  source: new Stamen({
    layer: 'watercolor',
  }),
  visible: false,
});
const stamen2 = new TileLayer({
  source: new Stamen({
    layer: 'toner',
  }),
  visible: false,
});
const baseLayers = [ osmLayer, stamen1, stamen2 ];

const map = new Map({
  layers: [
    ...baseLayers,
    graticule],
  target: 'map',
  view: new View({
    projection: 'EPSG:3857',
    center: [0, 0],
    zoom: 1,
  }),
});
graticule2 && map.addLayer(graticule2)
window.debug = { map, baseLayers }

const queryInput = document.getElementById('epsg-query');
const searchButton = document.getElementById('epsg-search');
const resultSpan = document.getElementById('epsg-result');
const renderEdgesCheckbox = document.getElementById('render-edges');
const showGraticuleCheckbox = document.getElementById('show-graticule');
const showOutlineCheckbox = document.getElementById('show-graticule-outline');
const layerSwitcherDiv = document.getElementById('layer-switcher');

function setProjection(code, name, proj4def, bbox) {
  if (code === null || name === null || proj4def === null || bbox === null) {
    resultSpan.innerHTML = 'Nothing usable found, using EPSG:3857...';
    map.setView(
      new View({
        projection: 'EPSG:3857',
        center: [0, 0],
        zoom: 1,
      })
    );
    return;
  }

  resultSpan.innerHTML = '(' + code + ') ' + name;

  const newProjCode = 'EPSG:' + code;
  proj4.defs(newProjCode, proj4def);
  register(proj4);
  const newProj = getProjection(newProjCode);
  const fromLonLat = getTransform('EPSG:4326', newProj);

  const worldExtent = [bbox[1], bbox[2], bbox[3], bbox[0]];
  newProj.setWorldExtent(worldExtent);

  // approximate calculation of projection extent,
  // checking if the world extent crosses the dateline
  if (bbox[1] > bbox[3]) {
    worldExtent = [bbox[1], bbox[2], bbox[3] + 360, bbox[0]];
  }
  const extent = applyTransform(worldExtent, fromLonLat, undefined, 8);
  newProj.setExtent(extent);
  const newView = new View({
    projection: newProj,
  });
  map.setView(newView);
  newView.fit(extent);
}

function search(query) {
  resultSpan.innerHTML = 'Searching ...';
  // Get a number out of the query string:
  const queryNumber = (String(query).match(/[0-9].+/gi) || [''])[0];
  // console.log(`query, queryNumber`, query, queryNumber);
  fetch('https://epsg.io/?format=json&q=' + queryNumber)
    .then(function (response) {
      return response.json();
    })
    .then(function (json) {
      const results = json['results'];
      // console.log(`results`, results);
      if (results && results.length > 0) {
        for (var i = 0, ii = results.length; i < ii; i++) {
          const result = results[i];
          if (result) {
            const code = result['code'];
            const name = result['name'];
            const proj4def = result['proj4'];
            const bbox = result['bbox'];
            if (
              code &&
              code.length > 0 &&
              proj4def &&
              proj4def.length > 0 &&
              bbox &&
              bbox.length == 4
            ) {
              setProjection(code, name, proj4def, bbox);
              return;
            }
          }
        }
      }
      setProjection(null, null, null, null);
    });
}

/**
 * Handle click event.
 * @param {Event} event The event.
 */
searchButton.onclick = function (event) {
  search(queryInput.value);
  event.preventDefault();
};

/**
 * Handle checkbox change event.
 */
renderEdgesCheckbox.onchange = function () {
  map.getLayers().forEach(function (layer) {
    if (layer instanceof TileLayer) {
      const source = layer.getSource();
      if (source instanceof TileImage) {
        source.setRenderReprojectionEdges(renderEdgesCheckbox.checked);
      }
    }
  });
};

/**
 * Handle checkbox change event.
 */
const graticuleOnChange = function () {
  graticule.setVisible(showGraticuleCheckbox.checked);
  // graticule2 ? graticule2.setVisible(showGraticuleCheckbox.checked) : 0;
};
showGraticuleCheckbox.onchange = graticuleOnChange
const outlineOnchange = ()=>{
  graticule2.setVisible(showOutlineCheckbox.checked); 
}
showOutlineCheckbox.onchange = outlineOnchange;

// Initiate:
graticuleOnChange(); outlineOnchange();
const match = window.location.search.match(/projQuery=\D*([0-9]*)\D*[^&]*/i);
const isMatch = !!(match && match[1]);
const urlProjQueryNumber =  isMatch ? match[1] : 25832;
search(urlProjQueryNumber);

if (!isMatch) {
  setTimeout(() => {
    map.getView().setCenter([545817.3271329966, 6177480.060318704]);
    map.getView().setZoom(5);
  }, 1500)
}

// Set up layer switcher:
baseLayers.forEach((layer, i)=>{  
  const div = document.createElement('div')
  div.style = `
    background: #eee; 
    margin: 1rem; padding: 0.5rem; width: 20rem;
    border-radius: 0.5rem; cursor: pointer;
    border: 1px solid #999;
    box-shadow: rgb(238 238 238) 4px 4px 4px 0px;
  `;
  div.id = `layer${i}`
  div.innerHTML = `${layer.getVisible() ? '[✓]' : '[_]'} &nbsp; Layer ${i+1}`;
  div.onclick = ()=>{  
    layer.setVisible(!layer.getVisible());
    // Switch other layers off:
    baseLayers.forEach((lr, j)=>{  
      if(j!==i){
        lr.setVisible(false);
      }
      // Update div:
      const div2 = document.getElementById(`layer${j}`);
      div2.innerHTML = div2.innerHTML.replace(/✓|_/gi, lr.getVisible() ? '✓' : '_');
    });
  }
  layerSwitcherDiv.appendChild(div)
});

