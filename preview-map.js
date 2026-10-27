/* Worker-free rendering for the opaque-origin embedded preview. */
window.startRxPreviewMap = async function({tracts,counties,stats}) {
  if(!window.L) throw new Error('The preview map library could not load.');
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v).toLocaleString('en-US');
  const json=async p=>{const r=await fetch(p);if(!r.ok)throw new Error(p);return r.json()};
  const [pharm,roads,neighborhoods,lockers,kiosks,remote,directory]=await Promise.all(
    ['pharmacies_495.geojson','portland_highways.geojson','portland_neighborhoods.geojson','oregon_lockers.geojson','oregon_kiosks.geojson','oregon_remote.geojson','access_locations.json'].map(n=>json('data/'+n)));
  const map=L.map('map-canvas',{zoomControl:false,scrollWheelZoom:false,minZoom:4,maxZoom:16,zoomSnap:.1,zoomDelta:.5});
  window.rxAccessPreviewMap=map;
  L.control.zoom({position:'topright'}).addTo(map);
  L.control.scale({position:'bottomright',metric:false}).addTo(map);
  // The research map uses actual Census geometry without a remote tile dependency.
  map.attributionControl.addAttribution('Boundaries: U.S. Census Bureau · Roads: OpenStreetMap');
  let selected=null, statewideView=true;
  const style=f=>{
    const p=f.properties,m=$('map-mode').value;
    let c='#dbe3ea';
    if(!p.analyzed)c='#eee';
    else if(m==='vulnerability'){
      const s=p.RPL_THEMES;
      c=s==null?'#eee':s>=.75?'#237d91':s>=.5?'#66aaba':s>=.25?'#a8d0da':'#dfeff2';
    } else if(m==='svi') c=p.is_dual_burden?'#d30a78':p.is_desert?'#eea62b':p.high_svi?'#3695a6':c;
    else if(m==='resilience')c=p.is_desert?'#eea62b':p.is_near_desert?'#376bb6':c;
    else c=p.is_desert?'#eea62b':c;
    if(m==='density'&&p.is_desert){
      const t=Math.log(1+p.pop_density)/Math.log(1+Math.max(...tracts.features.map(x=>x.properties.pop_density||0)));
      c=`rgb(${Math.round(189-147*t)},${Math.round(213-110*t)},${Math.round(232-75*t)})`;
    }
    return {color:p.GEOID===selected?'#2458bd':'#fff',weight:p.GEOID===selected?2.5:.45,fillColor:c,fillOpacity:.7,opacity:.8};
  };
  const show=p=>{
    selected=p.GEOID;tractLayer.setStyle(style);
    const label=!p.analyzed?'No workbook record':p.is_dual_burden?'Desert + high SVI':p.is_desert?'Desert flag':p.high_svi?'High SVI only':p.RPL_THEMES==null?'SVI unavailable':'Neither displayed flag';
    $('info-content').innerHTML=`<span class="info-badge">${label}</span><h4>${esc(p.NAMELSAD)}</h4><p class="small muted">${esc(p.county_name)} County<br>GEOID ${p.GEOID}</p>`+
      (p.analyzed?`<p class="small muted">${esc(p.place)}</p><dl><dt>2020 residents*</dt><dd>${fmt(p.population)}</dd><dt>Density / sq. mile</dt><dd>${fmt(p.pop_density)}</dd><dt>Source category</dt><dd>${p.urban_rural}</dd><dt>Straight-line distance</dt><dd>${Number(p.dist_nearest_mi).toFixed(2)} mi</dd><dt>Estimated drive</dt><dd>${Number(p.est_drive_min).toFixed(1)} min</dd><dt>Effective threshold</dt><dd>&gt;${p.threshold_mi} mi</dd><dt>Pharmacies in range*</dt><dd>${p.pharmacies_in_range}</dd><dt>SVI 2022 score</dt><dd>${p.RPL_THEMES==null?'Unavailable':Number(p.RPL_THEMES).toFixed(3)}</dd></dl><p class="small muted">*Source-labeled values from the supplied 495-outlet scenario. Travel is estimated, not routed. Eligibility, coordinates and population origins were not independently rerun here.</p>`:'<p class="small muted">Not in the 993-tract workbook; not classified as adequate access.</p>');
    $('map-status').textContent=`Selected: ${p.NAMELSAD} · ${p.county_name} County`;
    if(innerWidth>960)$('info-content').scrollIntoView({block:'nearest'});
  };
  const tractLayer=L.geoJSON(tracts,{style,onEachFeature:(f,l)=>l.on('click',()=>show(f.properties))}).addTo(map);
  const countyLayer=L.geoJSON(counties,{style:{color:'#687c83',weight:.8,opacity:.7,fill:false},interactive:false}).addTo(map);
  const roadLayer=L.geoJSON(roads,{style:f=>({color:f.properties.highlight?'#3563d3':'#7b858b',weight:f.properties.highlight?3:1.5}),onEachFeature:(f,l)=>l.bindTooltip(esc(f.properties.ref),{sticky:true})});
  const neighborhoodLayer=L.geoJSON(neighborhoods,{style:{color:'#7a5345',weight:1,dashArray:'3 3',fill:false},interactive:false});
  const cities=[['Portland',45.5152,-122.6784],['Salem',44.9429,-123.0351],['Eugene',44.0521,-123.0868],['Bend',44.0582,-121.3153],['Medford',42.3265,-122.8756]];
  cities.forEach(([name,lat,lon])=>L.marker([lat,lon],{interactive:false,icon:L.divIcon({className:'preview-city',html:`<span></span><b>${name}</b>`,iconSize:[110,24],iconAnchor:[6,12]})}).addTo(map));
  const fit=(features,zoom=11)=>{
    statewideView=features.length>900;
    map.fitBounds(L.geoJSON(features).getBounds(),{paddingTopLeft:[innerWidth>960?95:24,55],paddingBottomRight:[24,statewideView&&innerWidth>960?225:60],maxZoom:zoom,animate:false});
  };
  if(innerWidth<=640)map.setView([45.5,-122.68],9.3,{animate:false});else map.fitBounds([[45.28,-123.08],[45.70,-122.32]],{padding:[24,24],animate:false});statewideView=false;
  function focusCounty(code){
    selected=null;tractLayer.setStyle(style);
    fit(code?tracts.features.filter(f=>f.properties.COUNTYFP===code):tracts.features,code?11:8);
    $('map-status').textContent=code?`${stats.all_counties.find(c=>c.fips===code).name} County · supplied poster scenario`:'993 supplied tract records · October poster scenario';
  }
  $('county-filter').addEventListener('change',e=>focusCounty(e.target.value));
  $('county-table').addEventListener('click',e=>{const b=e.target.closest('[data-county]');if(b){$('county-filter').value=b.dataset.county;focusCounty(b.dataset.county);$('map').scrollIntoView({block:'start'});}});
  document.querySelectorAll('.zoom-btn').forEach(b=>b.addEventListener('click',()=>{
    $('county-filter').value='';selected=null;statewideView=false;tractLayer.setStyle(style);
    if(b.dataset.zoom==='oregon')fit(tracts.features,8);
    else if(b.dataset.zoom==='portland')map.fitBounds([[45.28,-123.08],[45.70,-122.32]],{padding:[28,28],animate:false});
    else{const c=cities.find(c=>c[0].toLowerCase()===b.dataset.zoom);map.setView([c[1],c[2]],11,{animate:false});}
    $('map-status').textContent=`${b.textContent} · supplied poster scenario`;
  }));
  $('tract-form').addEventListener('submit',e=>{
    e.preventDefault();const f=tracts.features.find(f=>f.properties.GEOID===$('tract-search').value.trim()&&f.properties.analyzed);
    if(!f){$('search-status').textContent='No analyzed tract found. Enter an 11-digit Oregon GEOID.';return}
    fit([f],12);show(f.properties);$('search-status').textContent=`Found ${f.properties.NAMELSAD}, ${f.properties.county_name} County.`;
  });
  const popup=(kind,records)=>`<strong>${esc(kind)}</strong><div class="pharmacy-records">${records.map(p=>`<p><strong>${esc(p.name)}</strong><br>${esc(p.address)}<br>${esc(p.city_state_zip||`${p.city||''}, ${p.state||''} ${p.zip||''}`)}<br>${esc(p.license)}</p>`).join('')}</div>`;
  const pointLayers={},pointMarkers={};
  const label={pharmacies:'Community pharmacy',lockers:'Prescription locker (PPL)',kiosks:'Prescription kiosk (PPK)',remote:'Remote-dispensing site (RDSP)'};
  for(const [kind,geo] of Object.entries({pharmacies:pharm,lockers,kiosks,remote})){
    pointLayers[kind]=L.layerGroup();pointMarkers[kind]=[];
    geo.features.forEach(f=>{
      const p=f.properties,records=JSON.parse(p.records||'[]'),ll=[f.geometry.coordinates[1],f.geometry.coordinates[0]];
      let marker;
      if(kind==='pharmacies')marker=L.circleMarker(ll,{radius:p.keystone?6:4.5,color:'#fff',weight:1.5,fillColor:p.keystone?'#E0127A':'#14284B',fillOpacity:1});
      else marker=L.marker(ll,{icon:L.divIcon({className:'preview-modality '+kind,html:kind==='lockers'?'L':kind==='kiosks'?'K':'R',iconSize:[24,24],iconAnchor:[12,12]})});
      if(kind==='pharmacies'){marker.bindPopup(`<strong>${p.keystone?'Keystone pharmacy':'Community pharmacy'}</strong><p><strong>${esc(p.name)}</strong><br>${esc(p.address)}<br>${esc(p.city)}, OR ${esc(p.zip)}<br>${esc(p.county)} County · ${esc(p.license)}</p>${p.keystone?`<p class="small muted">Only pharmacy in range for ${fmt(p.keystone_tracts)} tract(s) · ${fmt(p.keystone_pop)} residents</p>`:''}`,{maxWidth:300});marker.bindTooltip(`${esc(p.name)} · ${esc(p.address)}`);}
      else marker.bindPopup(popup(label[kind],records),{maxWidth:300,maxHeight:250});
      marker.addTo(pointLayers[kind]);
      pointMarkers[kind].push({marker,records,ll});
    });
    $(`layer-${kind}`).addEventListener('change',()=>{if($(`layer-${kind}`).checked)pointLayers[kind].addTo(map);else map.removeLayer(pointLayers[kind]);legend();});
  }
  ['lockers','kiosks'].forEach(kind=>$('focus-'+kind).addEventListener('click',()=>{
    statewideView=false;
    $(`layer-${kind}`).checked=true;pointLayers[kind].addTo(map);
    map.fitBounds(L.latLngBounds(pointMarkers[kind].map(x=>x.ll)),{padding:[40,40],maxZoom:kind==='kiosks'?14:9});
    if(kind==='kiosks')pointMarkers[kind][0].marker.openPopup();
    $('map-status').textContent=kind==='lockers'?'18 locker rows mapped · 1 withheld':'Prescription kiosk · SDHC PHARMACY';
    legend();
  }));
  function syncLayers(){
    for(const [id,layer] of Object.entries({'layer-tracts':tractLayer,'layer-counties':countyLayer,'layer-neighborhoods':neighborhoodLayer})){
      if($(id).checked)layer.addTo(map);else map.removeLayer(layer);
    }
    if($('layer-roads').checked&&map.getZoom()>=9)roadLayer.addTo(map);else map.removeLayer(roadLayer);
  }
  ['layer-tracts','layer-counties','layer-neighborhoods','layer-roads'].forEach(id=>$(id).addEventListener('change',syncLayers));
  map.on('zoomend',syncLayers);
  function legend(){
    const m=$('map-mode').value;
    const help={svi:'Magenta: both flags. Gold: desert only. Teal: SVI ≥0.75 only. Neither flag does not prove adequate access.',desert:'Desert flags from the supplied 495-outlet scenario. Estimated travel, not road-network routing.',vulnerability:'SVI 2022 scores as supplied. Missing SVI is not low vulnerability.',density:'Log-scaled density within supplied desert tracts. Darker blue means denser, not a validated priority score.',resilience:'Blue: one pharmacy in the supplied range. Gold: already flagged as desert. Not a closure forecast.'};
    const colors=m==='svi'?[['#d30a78','Desert + SVI ≥0.75'],['#eea62b','Desert only'],['#3695a6','High SVI only'],['#dbe3ea','Neither displayed flag']]:
      m==='vulnerability'?[['#dfeff2','SVI 0 to <0.25'],['#a8d0da','SVI 0.25 to <0.50'],['#66aaba','SVI 0.50 to <0.75'],['#237d91','SVI 0.75 to 1']]:
      m==='resilience'?[['#eea62b','Desert flag'],['#376bb6','One pharmacy in range'],['#dbe3ea','Neither access flag']]:
      m==='density'?[['#bdd5e8','Lower density in desert tracts'],['#2a679d','Higher density in desert tracts'],['#dbe3ea','No desert flag']]:
      [['#eea62b','Desert flag'],['#dbe3ea','No desert flag']];
    colors.push(['#eee',m==='vulnerability'?'No record / SVI unavailable':'No workbook record']);
    $('mode-help').textContent=help[m];
    $('dynamic-legend').innerHTML=colors.map(([c,t])=>`<div class="legend-row"><span class="swatch" style="background:${c}"></span>${t}</div>`).join('')+
      ($('layer-pharmacies').checked?'<div class="legend-row"><span class="swatch pin"></span>Community pharmacy (495)</div><div class="legend-row"><span class="swatch pin keystone"></span>Keystone pharmacy (141)</div>':'');
  }
  $('map-mode').addEventListener('change',()=>{tractLayer.setStyle(style);legend()});
  $('access-directory-content').innerHTML=['lockers','kiosks','remote'].map(kind=>`<h3>${label[kind]}: ${directory[kind].length} records</h3><div class="access-record-grid">${directory[kind].map((r,i)=>`<article class="access-record"><h4>${esc(r.name)}</h4><p>${esc(r.address)}<br>${esc(r.city_state_zip||`${r.city||''}, ${r.state||''} ${r.zip||''}`)}</p><p class="muted">License: ${esc(r.license)}</p>${r.map_status==='withheld'?`<p class="record-warning">${esc(r.quality_note)}</p>`:`<button data-preview-kind="${kind}" data-preview-index="${i}">View on map</button>`}</article>`).join('')}</div>`).join('');
  $('access-directory-content').addEventListener('click',e=>{
    const b=e.target.closest('[data-preview-kind]');if(!b)return;const kind=b.dataset.previewKind,r=directory[kind][Number(b.dataset.previewIndex)];
    const p=pointMarkers[kind].find(x=>x.records.some(x=>x.license===r.license&&x.address===r.address));if(!p)return;
    statewideView=false;
    $('layer-'+kind).checked=true;pointLayers[kind].addTo(map);map.setView(p.ll,14,{animate:false});p.marker.openPopup();$('map-canvas').scrollIntoView({block:'center'});legend();
  });
  document.querySelectorAll('.map-sidebar input,.map-sidebar select,.map-sidebar button').forEach(e=>e.disabled=false);
  legend();syncLayers();if($('layer-pharmacies').checked)pointLayers.pharmacies.addTo(map);
  $('map-loading').classList.add('hidden');$('map-loading').setAttribute('aria-hidden','true');
  new ResizeObserver(()=>{map.invalidateSize();if(statewideView)fit(tracts.features,8)}).observe($('map-canvas'));
};
