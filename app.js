/* RxAccess Oregon: supplied October poster scenario, with explicit provenance boundaries. */
(() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const fmt = n => Number(n).toLocaleString('en-US');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = name => getComputedStyle(root).getPropertyValue(name).trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let theme = 'light';
  let map, ready = false, tracts, counties, stats;
  const modalityLabels = {lockers:'Prescription locker (PPL)', kiosks:'Prescription kiosk (PPK)', remote:'Remote-dispensing site (RDSP)'};
  const modalityLetters = {lockers:'L', kiosks:'K', remote:'R'};
  const modalityMarkers = [];
  let accessData, modalityData;
  const controls = [...document.querySelectorAll('.map-sidebar input, .map-sidebar button, .map-sidebar select')];
  const themeButton = document.querySelector('[data-theme-toggle]');
  if (innerWidth <= 640) document.querySelector('.map-key').open = false;
  function setTheme() {
    root.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? 'Light' : 'Dark';
    themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    if (ready) paint();
  }
  setTheme();
  themeButton.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; setTheme(); });

  async function json(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Data unavailable: ${path}`);
    return response.json();
  }
  function bounds(features) {
    const b = new maplibregl.LngLatBounds();
    function walk(coords) {
      if (typeof coords[0] === 'number') b.extend(coords);
      else coords.forEach(walk);
    }
    features.forEach(f => walk(f.geometry.coordinates));
    return b;
  }
  function fit(features, maxZoom = 11) {
    if (!features.length) return;
    const statewide = features.length > 900;
    map.fitBounds(bounds(features), {padding: {top: 55, bottom: statewide ? (innerWidth <=640 ? 65 : 225) : 65, left: statewide && innerWidth>960 ? 95 : 32, right: 32}, maxZoom, duration: reduced ? 0 : 850});
  }
  function populateCounties() {
    $('county-table').querySelector('tbody').innerHTML = stats.all_counties.map(c => `<tr>
      <td><button class="county-link" data-county="${c.fips}">${esc(c.name)}</button></td>
      <td>${c.n_desert} / ${c.n_tracts}</td><td>${c.pct_desert}%</td><td>${fmt(c.pop_in_desert)}</td>
      <td>${c.n_dual}</td></tr>`).join('');
    $('county-filter').innerHTML += [...stats.all_counties].sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.fips}">${esc(c.name)}</option>`).join('');
    $('county-table').addEventListener('click', event => {
      const button = event.target.closest('[data-county]');
      if (!button || !ready) return;
      $('county-filter').value = button.dataset.county;
      focusCounty(button.dataset.county);
      $('map').scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
    });
  }
  const views = {
    oregon: null, portland: {bounds:[[-123.08,45.28],[-122.32,45.70]]},
    salem: {center:[-123.0351,44.9429],zoom:11}, eugene:{center:[-123.0868,44.0521],zoom:11},
    bend:{center:[-121.3153,44.0582],zoom:11}, medford:{center:[-122.8756,42.3265],zoom:11}
  };
  function resetSelection() {
    map.setFilter('tracts-selected', ['==', ['get','GEOID'], '']);
    $('info-content').innerHTML = '<p class="info-empty">Select a tract to review the supplied poster classification and source limitations.</p>';
  }
  function focusCounty(code) {
    resetSelection();
    fit(code ? tracts.features.filter(f => f.properties.COUNTYFP === code) : tracts.features, code ? 11 : 8);
    $('map-status').textContent = code ? `${stats.all_counties.find(c=>c.fips===code).name} County · supplied poster scenario` : '993 supplied tract records · October poster scenario';
  }
  document.querySelectorAll('.zoom-btn').forEach(button => button.addEventListener('click', () => {
    if (!ready) return;
    $('county-filter').value = '';
    resetSelection();
    const v = views[button.dataset.zoom];
    if (!v) fit(tracts.features, 8);
    else if (v.bounds) map.fitBounds(v.bounds, {padding:32,duration:reduced ? 0 : 850});
    else map.flyTo({...v, duration:reduced ? 0 : 850});
    $('map-status').textContent = `${button.textContent} · supplied poster scenario`;
  }));
  $('county-filter').addEventListener('change', e => { if (ready) focusCounty(e.target.value); });

  function showTract(p) {
    const analyzed = p.analyzed === true || p.analyzed === 'true';
    const desert = Number(p.is_desert) === 1;
    const high = p.high_svi === true || p.high_svi === 'true';
    const scoreValid = p.RPL_THEMES != null && Number(p.RPL_THEMES)>=0;
    const classification = desert ? (high?'Desert + high SVI':'Desert flag') : (high?'High SVI only':scoreValid?'Neither displayed flag':'SVI unavailable');
    $('info-content').innerHTML = `<span class="info-badge ${desert?'desert':'served'}">${analyzed ? classification : 'No workbook record'}</span>
      <h4>${esc(p.NAMELSAD)}</h4><p class="small muted">${esc(p.county_name)} County<br>GEOID ${esc(p.GEOID)}</p>
      ${analyzed ? `<p class="small muted">${esc(p.place || '')}</p><dl><dt>2020 residents*</dt><dd>${fmt(p.population)}</dd>
      <dt>Density / sq. mile</dt><dd>${fmt(Math.round(p.pop_density))}</dd>
      <dt>Source category</dt><dd>${esc(p.urban_rural)}</dd>
      <dt>Straight-line distance</dt><dd>${Number(p.dist_nearest_mi).toFixed(2)} mi</dd>
      <dt>Estimated drive</dt><dd>${Number(p.est_drive_min).toFixed(1)} min</dd>
      <dt>Effective threshold</dt><dd>&gt;${p.threshold_mi} mi</dd>
      <dt>Pharmacies in range*</dt><dd>${fmt(p.pharmacies_in_range)}</dd>
      <dt>SVI 2022 score</dt><dd>${scoreValid ? Number(p.RPL_THEMES).toFixed(3) : 'Unavailable'}</dd></dl>
      <p class="small muted selection-note">*Source-labeled values from the supplied 495-outlet scenario. Estimated travel is not routed. Eligibility, geocoding and population origins have not been independently rerun here.</p>` :
      '<p class="small muted">This geometry has no matched poster workbook record. It is excluded from the 993-tract denominator, not counted as adequate access.</p>'}`;
    map.setFilter('tracts-selected', ['==', ['get','GEOID'], p.GEOID]);
    $('map-status').textContent = `Selected: ${p.NAMELSAD} · ${p.county_name} County`;
    if (innerWidth > 960) {
      const sidebar = document.querySelector('.map-sidebar');
      sidebar.scrollTo({top: sidebar.scrollHeight, behavior: reduced ? 'auto' : 'smooth'});
    }
  }
  $('tract-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!ready) return;
    const value = $('tract-search').value.trim();
    const found = tracts.features.find(f => f.properties.GEOID === value && f.properties.analyzed);
    if (!found) {
      $('search-status').textContent = 'No analyzed tract found. Enter an 11-digit Oregon GEOID.';
      return;
    }
    $('search-status').textContent = `Found ${found.properties.NAMELSAD}, ${found.properties.county_name} County.`;
    fit([found], 12);
    showTract(found.properties);
  });

  function paint() {
    if (!ready) return;
    const mode = $('map-mode').value;
    const noData = theme==='dark' ? '#727b86' : '#eeeeee';
    const no=['==',['get','analyzed'],false], desert=['==',['get','is_desert'],1], high=['==',['get','high_svi'],true];
    const color = mode==='svi' ? ['case',no,noData,['==',['get','is_dual_burden'],1],'#d30a78',desert,'#eea62b',high,'#3695a6',css('--color-served')] :
      mode==='vulnerability' ? ['case',no,noData,['==',['get','RPL_THEMES'],null],noData,['>=',['get','RPL_THEMES'],.75],'#237d91',['>=',['get','RPL_THEMES'],.5],'#66aaba',['>=',['get','RPL_THEMES'],.25],'#a8d0da','#dfeff2'] :
      mode==='resilience' ? ['case',no,noData,desert,'#eea62b',['==',['get','is_near_desert'],1],'#376bb6',css('--color-served')] :
      ['case',no,noData,desert,css('--color-desert'),css('--color-served')];
    map.setPaintProperty('tracts-fill','fill-color',color);
    map.setPaintProperty('tracts-outline','line-color',theme==='dark'?'#5b696c':'#ffffff');
    map.setPaintProperty('tracts-selected','line-color',theme==='dark'?'#ffffff':'#254bb4');
    map.setPaintProperty('counties-line','line-color',theme==='dark'?'#aac0c6':'#687c83');
    map.setLayoutProperty('density-fill','visibility',mode==='density' && $('layer-tracts').checked?'visible':'none');
    map.setLayoutProperty('svi-fill','visibility','none');
    const help = {
      desert:'Desert flags from the supplied 495-outlet scenario. Estimated travel, not road-network routing.',
      density:'Continuous log-scaled density within supplied desert tracts. Darker blue means denser, not a validated priority score.',
      svi:'Magenta: both flags. Gold: desert only. Teal: SVI ≥0.75 only. Neither flag does not prove adequate access.',
      vulnerability:'SVI 2022 scores as supplied. Missing SVI is not classified as low vulnerability.',
      resilience:'Blue: exactly one pharmacy in the supplied range. Gold: already flagged as desert. This is not a closure forecast.'
    };
    $('mode-help').textContent = help[mode];
    const swatch=(c,t)=>`<div class="legend-row"><span class="swatch" style="background:${c}"></span>${t}</div>`;
    const legend = mode==='svi' ? [['#d30a78','Desert + SVI ≥0.75'],['#eea62b','Desert only'],['#3695a6','High SVI only'],[css('--color-served'),'Neither displayed flag']] :
      mode==='vulnerability' ? [['#dfeff2','SVI 0 to <0.25'],['#a8d0da','SVI 0.25 to <0.50'],['#66aaba','SVI 0.50 to <0.75'],['#237d91','SVI 0.75 to 1']] :
      mode==='resilience' ? [['#eea62b','Desert flag'],['#376bb6','One pharmacy in range'],[css('--color-served'),'Neither access flag']] :
      [[css('--color-desert'),'Desert flag'],[css('--color-served'),'No desert flag']];
    $('dynamic-legend').innerHTML=legend.map(x=>swatch(...x)).join('')+swatch(noData,mode==='vulnerability'?'No record / SVI unavailable':'No workbook record')+
      (mode==='density'?'<div class="density-ramp"></div><p>Density: lower → higher</p>':'')+
      ($('layer-pharmacies').checked?'<div class="legend-row"><span class="swatch pin"></span>Community pharmacy (495)</div><div class="legend-row"><span class="swatch pin keystone"></span>Keystone pharmacy (141)</div>':'');
  }
  const toggles = {
    'layer-tracts':['tracts-fill','tracts-outline','tracts-selected'],
    'layer-pharmacies':['pharmacies-halo','pharmacies-points','pharmacies-labels'],
    'layer-counties':['counties-line'],
    'layer-roads':['roads-casing','roads-line','roads-label'],
    'layer-neighborhoods':['neighborhoods-line']
  };
  Object.entries(toggles).forEach(([id,layers])=>$(id).addEventListener('change', e => {
    if (!ready) return;
    layers.forEach(layer=>map.setLayoutProperty(layer,'visibility',e.target.checked?'visible':'none'));
    paint();
  }));
  function modalityPopup(kind, records, coordinates) {
    const html = `<div class="popup-title">${esc(modalityLabels[kind])}</div>
      <p class="small muted">${records.length} source record${records.length===1?'':'s'}. Verify eligibility, hours, and services directly. Not interchangeable with a full-service pharmacy.</p>
      <div class="pharmacy-records">${records.map(p=>`<div class="pharmacy-record"><strong>${esc(p.name)}</strong>
      <p>${esc(p.address)}<br>${esc(p.city_state_zip || `${p.city}, ${p.state} ${p.zip}`)}</p>
      <small>${kind==='lockers'?'Parent license':'License'} ${esc(p.license)}${p.license_type ? ` · ${esc(p.license_type)}`:''}</small>
      ${p.parent_pharmacy_city?`<p class="small muted">Affiliated pharmacy: ${esc(p.parent_pharmacy_city)}</p>`:''}</div>`).join('')}</div>`;
    new maplibregl.Popup({maxWidth:'340px',offset:24,className:'modality-popup',...(innerWidth<=640?{anchor:'bottom'}:{})}).setLngLat(coordinates).setHTML(html).addTo(map);
  }
  function setModalityVisibility(kind) {
    modalityMarkers.filter(m=>m.kind===kind).forEach(m=>m.marker.getElement().hidden=!$(`layer-${kind}`).checked);
    paint();
  }
  for (const kind of ['lockers','kiosks','remote']) {
    $(`layer-${kind}`).addEventListener('change',()=>setModalityVisibility(kind));
  }
  function focusAccess(kind) {
    if (!ready) return;
    $(`layer-${kind}`).checked = true;
    setModalityVisibility(kind);
    fit(modalityData[kind].features,kind==='kiosks'?14:9);
    $('map-status').textContent = kind==='lockers' ? '18 locker rows mapped · 1 withheld' : 'Prescription kiosk · SDHC PHARMACY';
    if (kind==='kiosks') {
      const m=modalityMarkers.find(m=>m.kind===kind);
      modalityPopup(kind,m.records,m.coordinates);
    }
  }
  $('focus-lockers').addEventListener('click',()=>focusAccess('lockers'));
  $('focus-kiosks').addEventListener('click',()=>focusAccess('kiosks'));
  function addModalities() {
    for (const kind of Object.keys(modalityLabels)) {
      for (const feature of modalityData[kind].features) {
        const records=JSON.parse(feature.properties.records), coordinates=feature.geometry.coordinates;
        const el=document.createElement('button');
        el.type='button';
        el.className=`modality-marker ${kind}`;
        el.setAttribute('aria-label',`${modalityLabels[kind]}: ${records.map(r=>r.name).join('; ')}`);
        el.title=`${modalityLabels[kind]} · ${records.length} record${records.length===1?'':'s'}`;
        el.innerHTML=`<span class="glyph"><b>${modalityLetters[kind]}${records.length>1?records.length:''}</b></span>`;
        el.addEventListener('click',event=>{event.stopPropagation();modalityPopup(kind,records,coordinates);});
        const offsets={lockers:[18,-18],kiosks:[-18,-18],remote:[0,-22]};
        const marker=new maplibregl.Marker({element:el,offset:offsets[kind]}).setLngLat(coordinates).addTo(map);
        el.setAttribute('aria-label',`${modalityLabels[kind]}: ${records.map(r=>r.name).join('; ')}`);
        modalityMarkers.push({kind,records,coordinates,marker});
        el.hidden=!$(`layer-${kind}`).checked;
      }
    }
    $('access-directory-content').innerHTML=Object.entries(modalityLabels).map(([kind,label])=>`<h3>${esc(label)}: ${accessData[kind].length} records</h3>
      <div class="access-record-grid">${accessData[kind].map((r,index)=>`<article class="access-record"><h4>${esc(r.name)}</h4>
        <p>${esc(r.address)}<br>${esc(r.city_state_zip || `${r.city}, ${r.state} ${r.zip}`)}</p><p class="muted">${kind==='lockers'?'Parent license':'License'}: ${esc(r.license)}</p>
        ${r.map_status==='withheld'?`<p class="record-warning">${esc(r.quality_note)}</p>`:`<button data-access-kind="${kind}" data-access-index="${index}">View on map</button>`}</article>`).join('')}</div>`).join('');
    $('access-directory-content').addEventListener('click',event=>{
      const button=event.target.closest('[data-access-kind]');
      if(!button)return;
      const kind=button.dataset.accessKind, record=accessData[kind][Number(button.dataset.accessIndex)];
      const point=modalityMarkers.find(m=>m.kind===kind && m.records.some(r=>r.license===record.license && r.address===record.address));
      if(!point)return;
      $(`layer-${kind}`).checked=true;
      setModalityVisibility(kind);
      map.flyTo({center:point.coordinates,zoom:14,duration:reduced?0:850});
      modalityPopup(kind,point.records,point.coordinates);
      $('map-canvas').scrollIntoView({block:'center',behavior:reduced?'auto':'smooth'});
    });
  }
  function fail(message) {
    $('map-loading').classList.remove('hidden');
    $('map-loading').innerHTML = `<strong>Map unavailable</strong><p>${esc(message)}</p><button class="btn btn-primary" id="retry-map">Retry map</button><a href="#findings">Review the findings</a>`;
    $('retry-map').addEventListener('click',()=>location.reload());
  }
  async function initialize() {
    try {
      [tracts,counties,stats] = await Promise.all([json('data/oregon_tracts.geojson'),json('data/oregon_counties.geojson'),json('data/poster_results.json')]);
      tracts.features.forEach(f=>{
        const p=f.properties;
        f.properties=stats.tracts[p.GEOID] || {GEOID:p.GEOID,COUNTYFP:p.COUNTYFP,county_name:p.county_name,NAMELSAD:p.NAMELSAD,analyzed:false};
      });
      populateCounties();
      // Opaque-origin previews cannot exchange MapLibre worker messages reliably.
      // Use a DOM/SVG renderer there, with identical supplied data and controls.
      if (window.origin === 'null' || new URLSearchParams(location.search).get('renderer') === 'svg') {
        await window.startRxPreviewMap({tracts,counties,stats});
        return;
      }
      if (!window.maplibregl) throw new Error('The map library could not load. Check your connection and retry.');
      map = new maplibregl.Map({container:'map-canvas',style:'https://tiles.openfreemap.org/styles/positron',
        center:[-122.68,45.5],zoom:9.5,minZoom:4,maxZoom:16,attributionControl:{compact:true}});
      window.rxAccessMap = map;
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
      map.addControl(new maplibregl.ScaleControl({unit:'imperial'}),'bottom-right');
      const watchdog = setTimeout(()=>{if(!ready)fail('The map service is taking too long. The findings and methodology remain available below.');},30000);
      // Research layers must not wait for all external vector basemap tiles.
      map.once('style.load', async () => {
        try {
          // Remove basemap labels to prevent competing city/route annotations.
          for (const layer of map.getStyle().layers) if (layer.type==='symbol') map.setLayoutProperty(layer.id,'visibility','none');
          const [pharmacies, neighborhoods, roads, lockers, kiosks, remote, directory] = await Promise.all([
            json('data/pharmacies_495.geojson'),json('data/portland_neighborhoods.geojson'),json('data/portland_highways.geojson'),
            json('data/oregon_lockers.geojson'),json('data/oregon_kiosks.geojson'),json('data/oregon_remote.geojson'),json('data/access_locations.json')]);
          modalityData={lockers,kiosks,remote};
          accessData=directory;
          map.addSource('tracts',{type:'geojson',data:tracts});
          map.addLayer({id:'tracts-fill',type:'fill',source:'tracts',paint:{'fill-color':'#cbd8de','fill-opacity':0.65}});
          const maxDensity = Math.max(...tracts.features.map(f=>f.properties.pop_density || 0));
          map.addLayer({id:'density-fill',type:'fill',source:'tracts',filter:['==',['get','is_desert'],1],layout:{visibility:'none'},
            paint:{'fill-color':'#507da3','fill-opacity':['*',0.8,['/', ['ln',['+',1,['coalesce',['get','pop_density'],0]]],Math.log(1+maxDensity)]]}});
          map.addLayer({id:'svi-fill',type:'fill',source:'tracts',filter:['==',['get','is_dual_burden'],1],layout:{visibility:'none'},
            paint:{'fill-color':'#653d2a','fill-opacity':0.88}});
          map.addLayer({id:'tracts-outline',type:'line',source:'tracts',paint:{'line-color':'#ffffff','line-width':0.45,'line-opacity':0.65}});
          map.addSource('counties',{type:'geojson',data:counties});
          map.addLayer({id:'counties-line',type:'line',source:'counties',paint:{'line-color':'#687c83','line-width':0.8,'line-opacity':0.55}});
          map.addSource('neighborhoods',{type:'geojson',data:neighborhoods});
          map.addLayer({id:'neighborhoods-line',type:'line',source:'neighborhoods',layout:{visibility:'none'},paint:{'line-color':'#7a5345','line-width':1,'line-dasharray':[2,2]}});
          map.addSource('roads',{type:'geojson',data:roads});
          map.addLayer({id:'roads-casing',type:'line',source:'roads',minzoom:9,paint:{'line-color':'#ffffff','line-width':4,'line-opacity':0.9}});
          map.addLayer({id:'roads-line',type:'line',source:'roads',minzoom:9,paint:{'line-color':['case',['get','highlight'],'#3563d3','#7b858b'],'line-width':['case',['get','highlight'],2.6,1.7]}});
          map.addLayer({id:'roads-label',type:'symbol',source:'roads',minzoom:9,
            layout:{'symbol-placement':'line','symbol-spacing':350,'text-field':['get','ref'],'text-size':12,'text-font':['Noto Sans Regular'],'text-padding':16,'text-keep-upright':true},
            paint:{'text-color':'#334155','text-halo-color':'#ffffff','text-halo-width':2}});
          map.addLayer({id:'tracts-selected',type:'line',source:'tracts',filter:['==',['get','GEOID'],''],paint:{'line-color':'#254bb4','line-width':2.5}});
          map.addSource('pharmacies',{type:'geojson',data:pharmacies});
          map.addLayer({id:'pharmacies-halo',type:'circle',source:'pharmacies',filter:['==',['get','keystone'],true],
            paint:{'circle-color':'rgba(224,18,122,0.18)','circle-radius':['interpolate',['linear'],['zoom'],6,5,10,9,14,15],'circle-stroke-width':0}});
          map.addLayer({id:'pharmacies-points',type:'circle',source:'pharmacies',
            paint:{'circle-color':['case',['get','keystone'],'#E0127A','#14284B'],
              'circle-radius':['interpolate',['linear'],['zoom'],6,2.2,10,4.2,13,6.5,16,9],
              'circle-stroke-width':['interpolate',['linear'],['zoom'],6,0.6,11,1.5,14,2],'circle-stroke-color':'#ffffff'}});
          map.addLayer({id:'pharmacies-labels',type:'symbol',source:'pharmacies',minzoom:13.5,
            layout:{'text-field':['get','name'],'text-font':['Noto Sans Bold'],'text-size':11,'text-offset':[0,1.1],'text-anchor':'top','text-max-width':10,'text-optional':true},
            paint:{'text-color':'#14284B','text-halo-color':'#ffffff','text-halo-width':1.6}});
          const cities = [['Portland',-122.6784,45.5152],['Salem',-123.0351,44.9429],['Eugene',-123.0868,44.0521],['Bend',-121.3153,44.0582],['Medford',-122.8756,42.3265]];
          map.addSource('cities',{type:'geojson',data:{type:'FeatureCollection',features:cities.map(([name,lon,lat])=>({type:'Feature',properties:{name},geometry:{type:'Point',coordinates:[lon,lat]}}))}});
          map.addLayer({id:'cities-rings',type:'circle',source:'cities',paint:{'circle-radius':5,'circle-color':'rgba(255,255,255,0.4)','circle-stroke-color':'#334155','circle-stroke-width':2}});
          map.moveLayer('cities-rings','pharmacies-halo');
          map.addLayer({id:'cities-label',type:'symbol',source:'cities',layout:{'text-field':['get','name'],'text-font':['Noto Sans Bold'],'text-size':13,'text-variable-anchor':['left','top-left','bottom-left','right'],'text-radial-offset':1,'text-padding':8},paint:{'text-color':'#334155','text-halo-color':'#ffffff','text-halo-width':2}});
          map.on('click', e => {
            const hits = map.queryRenderedFeatures(e.point,{layers:['pharmacies-points']});
            if (hits.length) return;
            const tract = map.queryRenderedFeatures(e.point,{layers:['tracts-fill']})[0];
            if (tract) showTract(tract.properties);
          });
          const pharmacyHtml = p => `<div class="popup-title rx-popup-title"><span class="rx-tag ${p.keystone?'keystone':''}">${p.keystone?'Keystone pharmacy':'Community pharmacy'}</span>${esc(p.name)}</div>
              <p class="rx-address">${esc(p.address)}<br>${esc(p.city)}, OR ${esc(p.zip)}</p>
              <p class="small muted">${esc(p.county)} County · License ${esc(p.license)}</p>
              ${p.keystone?`<p class="rx-keystone-note">Only pharmacy in range for ${fmt(p.keystone_tracts)} tract${Number(p.keystone_tracts)===1?'':'s'} · ${fmt(p.keystone_pop)} residents</p>`:''}
              <a class="rx-directions" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address} ${p.city} OR ${p.zip}`)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>`;
          const hover = new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:10,className:'rx-hover'});
          map.on('click','pharmacies-points', e => {
            hover.remove();
            const feature = e.features[0];
            new maplibregl.Popup({maxWidth:'300px',offset:12,className:'rx-popup'}).setLngLat(feature.geometry.coordinates).setHTML(pharmacyHtml(feature.properties)).addTo(map);
          });
          map.on('mousemove','pharmacies-points', e => {
            const p = e.features[0].properties;
            hover.setLngLat(e.features[0].geometry.coordinates).setHTML(`<strong>${esc(p.name)}</strong><br>${esc(p.address)}, ${esc(p.city)}`).addTo(map);
          });
          map.on('mouseleave','pharmacies-points',()=>hover.remove());
          for (const id of ['tracts-fill','pharmacies-points']) {
            map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');
            map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');
          }
          ready = true;
          addModalities();
          Object.entries(toggles).forEach(([id,layers])=>layers.forEach(layer=>map.setLayoutProperty(layer,'visibility',$(id).checked?'visible':'none')));
          clearTimeout(watchdog);
          controls.forEach(control=>control.disabled=false);
          paint();
          if (innerWidth<=640) map.jumpTo({center:[-122.68,45.5],zoom:9.3}); else map.fitBounds(views.portland.bounds,{padding:24,duration:0});
          $('map-loading').classList.add('hidden');
          $('map-loading').setAttribute('aria-hidden','true');
          new ResizeObserver(()=>map.resize()).observe($('map-canvas'));
        } catch (error) { clearTimeout(watchdog); console.error(error); fail('Some research layers could not load. Please retry.'); }
      });
    } catch (error) { console.error(error); fail('The supplied data or map library could not load. Check your connection and retry.'); }
  }
  $('map-mode').addEventListener('change',paint);
  $('metro-cta').addEventListener('click',()=>{
    document.querySelector('[data-zoom="portland"]').click();
    $('map').scrollIntoView({behavior:reduced?'auto':'smooth'});
  });
  $('county-search').addEventListener('input',event=>{
    let visible=0;
    document.querySelectorAll('#county-table tbody tr').forEach(row=>{
      row.hidden=!row.cells[0].textContent.toLowerCase().includes(event.target.value.trim().toLowerCase());
      if(!row.hidden)visible++;
    });
    $('county-search-status').textContent=visible?`${visible} counties shown`:'No matching county. Clear the search to see all 36.';
  });
  document.querySelectorAll('.poster-open').forEach(button=>button.addEventListener('click',()=>{
    $('enlarged-figure').classList.remove('zoomed');
    $('zoom-figure').textContent='Zoom in';
    $('zoom-figure').setAttribute('aria-pressed','false');
    $('enlarged-figure').src=button.dataset.image;
    $('enlarged-figure').alt=button.dataset.title;
    $('figure-title').textContent=button.dataset.title;
    $('figure-dialog').showModal();
  }));
  $('close-figure').addEventListener('click',()=>$('figure-dialog').close());
  $('zoom-figure').addEventListener('click',()=>{
    const zoomed=$('enlarged-figure').classList.toggle('zoomed');
    $('zoom-figure').textContent=zoomed?'Fit image':'Zoom in';
    $('zoom-figure').setAttribute('aria-pressed',String(zoomed));
  });
  document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{
    const note=document.createElement('p');note.className='image-error';note.textContent='This reference image could not load. Please refresh and try again.';img.replaceWith(note);
  }));
  initialize();
})();
