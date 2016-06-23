var startLatitude=0.0, startLongitude=0.0;
var geojsonLayer;
var marker;
var eventPaneOpen=false;
var foundEventCircle;

L.ImageOverlay.include({
    getBounds: function () {
        return this._bounds;
    }
});

//Initializarea obiectului de harta nivele de zoom, si extensia
var map = L.map('map', {
    zoomControl:true, 
	maxZoom:28, 
	minZoom:1
}).fitBounds([[44.7636192438,21.7002911194],[47.3754662077,28.6964999049]]);

//Setare bounds - harta ramane centrata in zona romaniei
map.setMaxBounds([[40, 18],[50, 34]]);

var hash = new L.Hash(map);

map.attributionControl.addAttribution('<a href="https://github.com/tomchadwin/qgis2web" target="_blank">qgis2web</a><a>|</a><a href="http://project-osrm.org/" target="_blank">OSRM</a><a>|</a><a href="http://opendatacommons.org/licenses/odbl/" target="_blank">ODbL</a>');
var feature_group = new L.featureGroup([]);
var bounds_group = new L.featureGroup([]);
var raster_group = new L.LayerGroup([]);
/*var basemap0 = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors,<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    maxZoom: 28
});*/
//Stamen basemap
/*var basemap0 = L.tileLayer('http://a.tile.stamen.com/toner/{z}/{x}/{y}.png', {
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>,<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Mapdata: &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>contributors,<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    maxZoom: 28
});*/
//Stratul de baza de tip OSM black & white
var basemap0 = L.TileLayer.boundaryCanvas('http://{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
	boundary: romPolygon,
    maxZoom: 28
});
basemap0.addTo(map);

//Stratul cu umbrire
var hillUrl = 'http://{s}.tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png';
var hillAttribution = 'Hillshading: SRTM3 v2 (<a href="http://www2.jpl.nasa.gov/srtm/">NASA</a>)';
var hill = new L.TileLayer.boundaryCanvas(hillUrl, {minZoom: 10, maxZoom: 17, attribution: hillAttribution, boundary: romPolygon,});
map.addLayer(hill);

var layerOrder = new Array();
function stackLayers() {
    for (index = 0; index < layerOrder.length; index++) {
        map.removeLayer(layerOrder[index]);
        map.addLayer(layerOrder[index]);
    }
}
function restackLayers() {
    for (index = 0; index < layerOrder.length; index++) {
        layerOrder[index].bringToFront();
    }
}
layerControl = L.control.layers({},{},{collapsed:false});

//Functia care creaza continutul pentru popup
function pop_events(feature, layer) {
    var popupContent = '<table><tr><th scope="row">Nume</th><td>' +
    (feature.properties['Nume'] !== null ? Autolinker.link(String(feature.properties['Nume'])) : '') +
    '</td></tr><tr><th scope="row">Data</th><td>' +
    (feature.properties['Data'] !== null ? Autolinker.link(String(feature.properties['Data'])) : '') +
    '</td></tr><tr><th scope="row">Pagina Oficială</th><td>' +
    (feature.properties['PaginaOfic'] !== null ? Autolinker.link(String(feature.properties['PaginaOfic'])) : '') +
    '</td><tr><th scope="row">Județ</th><td>' +
    (feature.properties['JUD'] !== null ? Autolinker.link(String(feature.properties['JUD'])) : '') +
    '</td></tr><tr><th scope="row">Localitate</th><td>' +
    (feature.properties['Localitate'] !== null ? Autolinker.link(String(feature.properties['Localitate'])) : '') +
    '</td></tr><tr><th scope="row">Locație</th><td>' +
    (feature.properties['Locatie'] !== null ? Autolinker.link(String(feature.properties['Locatie'])) : '')+
	'</td></tr><tr><th scope="row">Stare</th><td>' +
    displayStatus(feature.properties['Stare'])+
    '</tr></table>'+
    '<table  align="center"><tr></td><td><img src=logo/'+feature.properties['Logo_Ofici']+' style="width:200px;"></td></tr>'+
    '<tr></td><td><button class="button" style="width:200px;" onclick="getRoute('+feature.geometry.coordinates[0]+','+feature.geometry.coordinates[1]+')">Arată drumul către eveniment</button></td></tr>'+
    '<tr></td><td><button class="button" onclick="getEventInPane('+feature.properties['PaginaEven']+')" style="width:200px;">Despre eveniment în detalii</button></td></tr></table>';
    layer.bindPopup(popupContent);
}

function displayStatus(inputString){
	var statusString;
	if (inputString!=null){
	    if (inputString==1){
			statusString="<font color='green'>Eveniment în viitor</font>";
		};
	    if (inputString==0){
			statusString="<font color='red'>Eveniment trecut</font>";
		}
	    if (inputString==2){
			statusString="<font color='orange'>Eveniment în așteptare</font>";
		}
	}
	return statusString;
}

//Functia pentru decodarea poliliniei
function decodePolyline(str, precision) {
    var index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision || 5);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor*0.1, lng / factor*0.1]);
    }

    return coordinates;
};

//Functia care transforma obiectul de intrare in geoJSON
function polylineToGeoJSON(str, precision) {
    var coords = decodePolyline(str, precision);
    return {
        type: 'LineString',
        coordinates: flipped(coords)
    };
};

function flipped(coords) {
    var flipped = [];
    for (var i = 0; i < coords.length; i++) {
        flipped.push(coords[i].slice().reverse());
    }
    return flipped;
}

//Setare stil pentru marker locatia de start
var startIconMarker = L.VectorMarkers.icon({
    iconSize:     [10, 20],
    shadowSize:   [10, 20],
    icon: 'home',
    prefix: 'fa',
    markerColor: '#89e200', 
    iconColor: '#eee8d5'
});

//Adaugare marker pentru locatia de start
function onMapClick(e) {
    if (marker!=null){
        map.removeLayer(marker);
    };
    //Creare marker care poate fi tras intr-o alta pozitie
    marker = new L.marker(e.latlng, {draggable:'true', icon: startIconMarker});
    marker.on('dragend', function(event){
        marker = event.target;
        var position = marker.getLatLng();
        marker.setLatLng(new L.LatLng(position.lat, position.lng),{draggable:'true'});
        map.panTo(new L.LatLng(position.lat, position.lng));
    });
    //memorarea cordonate punct de start in 2 variabile
    startLatitude=e.latlng.lat;
    startLongitude=e.latlng.lng;
    map.addLayer(marker);
};

//Markerul se adauga la click pe harta
map.on('click', onMapClick);

//Functia pentru modificarea timpului din secunde in ore minute si secunde
function toTimeString(inTime){        
    var hours=Math.floor(inTime/3600);
    var minutes=Math.floor((inTime-hours*3600)/60);
    var seconds=inTime-hours*3600-minutes*60;            
    return hours+' h, '+minutes+' m, '+seconds+' s';        
}

//Functia care aduce ruta
function getRoute(finishLongitude, finishLatitiude){
    //Daca punctul de pornire nu este definit apare o fereastra de avertizare de altfel se calculeaza traseul
    if (startLatitude==0){
        $.showMessageBox({
            content:'Marcați locația de pornire',
            title:'Locația de pornire',
            type: 'warning',
            CloseButtonText:'Închide'
        });
    }else{
        //Daca exista un traseu calculat si afisat pe harta trebuie sa stergem inainte de a calcula traseul nou
        if (geojsonLayer!=null){
            map.removeLayer(geojsonLayer)
        };
        //Compunerea URL-ului cu cererea catre serverul de rutare 
        var requestURL='http://router.project-osrm.org/viaroute?loc='+startLatitude+','+startLongitude+'&loc='+finishLatitiude+','+finishLongitude+'&instructions=false';
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open( "GET", requestURL, false );
        xmlHttp.send( null );
        //Parsarea raspunsului in JSON
        var parsedData = JSON.parse(xmlHttp.response);
        //Decodarea raspunsului (a geometriei) si transformarea lui in geoJSON
        var geoJSON=polylineToGeoJSON(parsedData.route_geometry);
        //Mesajul cu detaliile traseului (timp si distanta)
        $.showMessageBox({
            content:'Distanța: '+parsedData.route_summary.total_distance/1000+' km <br> Timp: '+ toTimeString(parsedData.route_summary.total_time),
            title:'Traseul',
            CloseButtonText:'Închide'
        });
        //Adaugrea traseului pe harta
        geojsonLayer=L.geoJson(geoJSON).addTo(map);
    }
}

//Functia cu animatia panelului de evenimente
function slideEventPane(show){
    if(show){
        diff = "+=470";
    }else{
        diff = "-=470";
    }
    //Miscarea panelului de evenimente
    $( ".event_panel" ).animate({
        left: diff
        }, 700, function() {
        });
    //Miscarea butoanelor de zoom impreuna cu panelul de evenimente
    $( ".leaflet-bar" ).animate({
        left: diff
        }, 700, function() {
        });
        
    //Miscarea scarii impreuna cu panelul de evenimente
    $( ".leaflet-bottom" ).animate({
        left: diff
        }, 700, function() {
        });

}

//Functia care adauga datele in panelul de evenimente si apeleaza animatia panelului
function getEventInPane(eventPageName){
    if (!eventPaneOpen){
        slideEventPane(true);
        eventPaneOpen=true;
    }
    //jQuery("#embeded_event").load("event_page/"+eventPageName+".html");
    jQuery("#embeded_event").load("event_page/electric_castle.html");
}

//Functia care inchide panelul de evenimente
$('.event_slider').click(function(){
    slideEventPane(false);
    eventPaneOpen=false;
})

//Setare stil pentru marker de eveniment viitor
var futureEventMarker = L.VectorMarkers.icon({
    iconSize:     [10, 20],
    shadowSize:   [10, 20],
    icon: 'circle',
    prefix: 'fa',
    markerColor: '#89e200', 
    iconColor: '#eee8d5'
});

//Setare stil pentru marker de eveniment trecut
var pastEventMarker = L.VectorMarkers.icon({
    iconSize:     [10, 20],
    shadowSize:   [10, 20],
    icon: 'circle',
    prefix: 'fa',
    markerColor: '#ff0000', 
    iconColor: '#eee8d5'
});

//Setare stil pentru marker de eveniment posibil
var possibleEventMarker = L.VectorMarkers.icon({
    iconSize:     [10, 20],
    shadowSize:   [10, 20],
    icon: 'circle',
    prefix: 'fa',
    markerColor: '#ffa500', 
    iconColor: '#eee8d5'
});

//Functia care returneaza culoarea iconului
function getEventMarkerStyle(inputString){
	var style;
	if (inputString!=null){
	    if (inputString==1){
			style=futureEventMarker;
		};
	    if (inputString==0){
			style=pastEventMarker;
		}
	    if (inputString==2){
			style=possibleEventMarker;
		}
	}
	return style;
}

//Adaugarea evenimentelor (entitate punct) ca si markere
function doPointToLayerEvents(feature, latlng) {
    return L.marker(latlng, {icon: getEventMarkerStyle(feature.properties['Stare'])})
}

//Citirea jsonului, mapare in popup si mapare afisare cu marker
var json_PunctefestivalWGS840JSON = new L.geoJson(json_PunctefestivalWGS840, {
    onEachFeature: pop_events, 
    pointToLayer: doPointToLayerEvents
    });
//Definirea clusterelor
var cluster_groupEventsJSON = new L.MarkerClusterGroup({showCoverageOnHover: false});
cluster_groupEventsJSON.addLayer(json_PunctefestivalWGS840JSON);

layerOrder[layerOrder.length] = cluster_groupEventsJSON;

bounds_group.addLayer(json_PunctefestivalWGS840JSON);
cluster_groupEventsJSON.addTo(map);
raster_group.addTo(map);
feature_group.addTo(map);

//Unealta de geocodare
var osmGeocoder = new L.Control.OSMGeocoder({
    collapsed: false,
    position: 'topright',
    text: 'Search',
});
osmGeocoder.addTo(map);
map.locate({setView: true, maxZoom: 16});

//Setare stil pentru marker geolocalizare
var geolocationIconMarker = L.VectorMarkers.icon({
    iconSize:     [10, 20],
    shadowSize:   [10, 20],
    icon: 'location-arrow',
    prefix: 'fa',
    markerColor: '#89e200', 
    iconColor: '#eee8d5'
});

function onLocationFound(e) {
    var radius = e.accuracy / 2;
    L.marker(e.latlng, {icon: geolocationIconMarker}).addTo(map)
    .bindPopup("Sunteți la " + radius + " metrii față de acest punct")
    .openPopup();
    L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);

//Adaugare scara hartii
L.control.scale({options: {position: 'bottomleft', maxWidth: 100, metric: true, imperial: false, updateWhenIdle: false}}).addTo(map);

stackLayers();
map.on('overlayadd', restackLayers);

//Functia cu animatia pentru panelul de cautare
$(function(){
    $('.search_slider').click(function(){
    var anchor = this;
    var removeClass = "hide";
    var addClass = "show";
    var diff = "-=360";
    var arrows = new Image(); 
    arrows.src="img/Search.png"
    arrows.width=23;
    if($(anchor).hasClass("show")){
        diff = "+=360";
        removeClass = "show";
        addClass="hide";
        arrows.src="img/Search_close.png"
    }
    $( ".search_panel" ).animate({
        right: diff
        }, 700, function() {
            $(anchor).html(arrows).removeClass(removeClass).addClass(addClass);
        });     
    });            
})

function searchEvent(searchVal){            
    var results=[];
    var eventFound=false;
    for (var i=0 ; i < json_PunctefestivalWGS840.features.length ; i++){
        if (json_PunctefestivalWGS840.features[i].properties['Nume'].toLowerCase().search(searchVal.toLowerCase())!== -1) {
            results.push(json_PunctefestivalWGS840.features[i]);
            eventFound=true;
        }
    }
    //stergerea cercului in cazul in care exista una deja
    if (foundEventCircle!= null) {
        map.removeLayer(foundEventCircle);
    }
    if (eventFound){
        //Creare cerc in jurul markerului de eveniment gasit
        foundEventCircle=L.circle(L.latLng(results[0].geometry.coordinates[1],results[0].geometry.coordinates[0]), 50).addTo(map);
        //Centrare harta pe eveniment gasit
        map.setView(L.latLng(results[0].geometry.coordinates[1],results[0].geometry.coordinates[0]),17)
    }else{
        $.showMessageBox({
            content:'Evenimentul nu a fost găsit',
            title:'Eroare de căutare eveniment',
            type: 'warning',
            CloseButtonText:'Închide'
        });
    }
}