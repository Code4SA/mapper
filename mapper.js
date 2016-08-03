﻿// get path to this script, to link to json data files
var ___thisPath = document.getElementsByTagName('script')[document.getElementsByTagName('script').length - 1].src.split('?')[0].split('/').slice(0, -1).join('/') + '/';

$(function () {
    "use strict";

    var provinceCodes = {
        'Eastern Cape': 'EC',
        'Western Cape': 'WC',
        'Free State': 'FS',
        'Gauteng': 'GT',
        'KwaZulu-Natal': 'KZN',
        'Limpopo': 'LIM',
        'Mpumalanga': 'MP',
        'North West': 'NW',
        'Northern Cape': 'NC',
    };

    $.widget("capesean.mapper", {
        // default options
        options: {
            fillColor: "#eee",
            fillOpacity: 0.5,
            strokeColor: "#000",
            strokeWeight: 1,
            strokeOpacity: 0.7,
            data: [],
            dataType: "",
            province: "",
            allowAllWards: false,
            drawAll: false
        },

        // init variables
        _minLat: null,
        _maxLat: null,
        _minLng: null,
        _maxLng: null,

        // load data
        _getData: function () {

            var url;
            switch (this.options.dataType) {
                case "provinces":
                    url = "/areas/PR.geojson";
                    break;
                case "districts":
                    url = "/areas/DC.geojson";
                    break;
                case "municipalities":
                    url = "/areas/MN.geojson";
                    break;
                case "wards":
                    // province filter not supplied
                    if (!this.options.province)
                        // error if not specifically requesting full wards file
                        if (!this.options.allowAllWards)
                            throw ("Error: Ward dataType requires either the province filter or the allowAllWards option enabled");
                        else
                            url = "/areas/WD.geojson";
                    else {
                        url = "/areas/MDB-levels:PR-" + provinceCodes(this.options.province) + "|WD.geojson";
                    }
                    break;
                default:
                    throw ("Error: Not Implemented dataType option in _getData: " + this.options.dataType);
            }

            url = "https://mapit.code4sa.org" + url + "?generation=2&simplify_tolerance=0.005";

            var json = null;
            $.ajax({
                'async': false,
                'global': false,
                'url': url,
                'dataType': "json",
                'success': function (data) {
                    json = data;
                }
            });
            return json;

        },

        // get bound limits by looping through all points
        _extendBounds: function(bounds, geom) {
            var self = this;

            if (geom.getType() == "MultiPolygon") {
                geom.getArray().forEach(function(poly) {
                    self._extendBounds(bounds, poly);
                });
            } else {
                //iterate over the paths
                geom.getArray().forEach(function(path) {
                    //iterate over the points in the path
                    path.getArray().forEach(function(latLng) {
                        bounds.extend(latLng);
                    });
                });
            }
        },

        // shifts elements in an array
        _moveArrayElement: function (arr, oldIndex, newIndex) {

            if (newIndex >= arr.length) newIndex = arr.length;
            arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);

        },

        // prepares the list - filtering, ordering, etc
        _prepareList: function (data) {
            for (var i = 0; i < data.features.length; i++) {
                // assign mapit code as id
                data.features[i].id = data.features[i].properties.codes.MDB;
            }

            // check if no data was supplied as an option
            if (!this.options.data || this.options.data.length == 0) return;

            // for each item in the full list
            for (var m = data.features.length - 1; m >= 0; m--) {

                var item = data.features[m];

                // try get it from the options list
                var option = $.grep(this.options.data, function (e) { return e.id == item.properties.codes.MDB; })[0];

                if (!option) {
                    // wasn't supplied, so remove from the list (unless drawAll == true)
                    if (!this.options.drawAll)
                        data.features.splice(m, 1);
                } else {
                    // copy the styles & other properties, eg html info window
                    item.properties.options = option;
                }
            }
        },

        // the constructor
        _create: function () {

            // can only handle these data entities:
            if (['provinces', 'districts', 'municipalities', 'wards'].indexOf(this.options.dataType) < 0) {
                alert("Invalid dataType option");
                return false;
            }

            // load the data
            var data = this._getData();

            // prepare the list
            this._prepareList(data);

            // setup map
            var mapOptions = { zoom: 0, center: new google.maps.LatLng(0, 0), mapTypeId: google.maps.MapTypeId.TERRAIN };
            var map = new google.maps.Map(this.element[0], mapOptions),
                bounds = new google.maps.LatLngBounds();

            // setup a global infoWindow
            var infoWindow = new google.maps.InfoWindow();

            var self = this;
            map.data.setStyle(function(feature) {
                // use the custom options for this feature, if given
                var options = feature.getProperty('options') || {};
                return {
                    strokeColor: options.strokeColor || self.options.strokeColor,
                    strokeOpacity: options.strokeOpacity || self.options.strokeOpacity,
                    strokeWeight: options.strokeWeight || self.options.strokeWeight,
                    fillColor: options.fillColor || self.options.fillColor,
                    fillOpacity: options.fillOpacity || self.options.fillOpacity,
                };
            });

            var features = map.data.addGeoJson(data);

            // extend bounds to include all the features
            for (var i = 0; i < features.length; i++) {
                this._extendBounds(bounds, features[0].getGeometry());
            }

            // zoom to fit the bounds
            map.fitBounds(bounds);
        }
    });
});


