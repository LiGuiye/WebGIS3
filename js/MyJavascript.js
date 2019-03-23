//统计图层数量的变量
require([
	"esri/Map",
	"esri/views/MapView",
	"esri/layers/TileLayer",
	"esri/core/watchUtils",
], function(Map, MapView, TileLayer, watchUtils) {

	//TileLayer FeatureLayer MapimageLayer GraphicLayer 
	//自己发布的china栅格切片
	var chinaLayer = new TileLayer({
		url: "https://tiles.arcgis.com/tiles/fmrXc7dh7x1uQcPs/arcgis/rest/services/%E4%B8%AD%E5%9B%BD%E5%BA%95%E5%9B%BE/MapServer",
		id: "china",
		visible: false
	});
	//路网图层
	var transportationLayer = new TileLayer({
		url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
		// This property can be used to uniquely identify the layer
		id: "streets",
		visible: false
	});
	//房屋图层
	var housingLayer = new TileLayer({
		url: "https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/New_York_Housing_Density/MapServer",
		id: "ny-housing",
		opacity: 0.9,
		visible: false
	});
	//右侧预置底图
	var map1 = new Map({
		basemap: "streets"
	});
	//待切换底图
	var mapnames = [
		"oceans",
		"osm",
	];
	var maps = mapnames.map(function(mapid) {
		return new Map({
			basemap: mapid
		});
	});
	//左边窗口
	var view = new MapView({
		container: "viewDiv",
		map: maps[0],
		zoom: 4,
		center: [15, 65] // longitude, latitude
	});
	//右边窗口
	var view2 = new MapView({
		id: 'view2',
		container: 'view2Div',
		map: map1,
		zoom: 4,
		center: [15, 65], // longitude, latitude
		constraints: {
			// Disable zoom snapping to get the best synchonization
			snapToZoom: false
		}
	});
	//路网图层标签
	var streetsLayerToggle = document.getElementById("streetsLayer");
	streetsLayerToggle.addEventListener("change", function() {
		transportationLayer.visible = streetsLayerToggle.checked;
		console.log(transportationLayer.visible);
		if (streetsLayerToggle.checked == true) {
			view.map.add(transportationLayer);
		} else {
			view.map.remove(transportationLayer);
		}

	});
	//房屋图层标签
	var housingLayerToggle = document.getElementById("housingLayer");
	housingLayerToggle.addEventListener("change", function() {
		housingLayer.visible = housingLayerToggle.checked;
		//console.log(housingLayerToggle.checked)
		if (housingLayerToggle.checked == true) {
			view.map.add(housingLayer);
			housingLayer.when(function() {
				view.goTo(housingLayer.fullExtent);
			});
		} else {
			view.map.remove(housingLayer);
		}
	});
	////////////////////////监测图层数量///////////////////////////////
	view.map.allLayers.on("change", function(event) {
		var num = event.target.length - 2;
		document.getElementById("layerNum").textContent = "图层数量： " + num;
	});
	///////////////////////////底图切换////////////////////////////////////////
	document.querySelector(".btns").addEventListener("click", function(event) {
		var id = event.target.getAttribute("data-id");
		if (id) {
			var map = maps[id];
			view.map = map;
			var nodes = document.querySelectorAll(".btn-switch");
			for (var idx = 0; idx < nodes.length; idx++) {
				var node = nodes[idx];
				var mapIndex = node.getAttribute("data-id");
				if (mapIndex === id) {
					node.classList.add("active-map");
				} else {
					node.classList.remove("active-map");
				}
			}
		}
	});
	/////////////////////显示信息///////////////////////////////////////
	view.watch(["stationary"], function() {
		showInfo(view.center);
	});
	view.on(["pointer-move"], function(evt) {
		showInfo(view.toMap({
			x: evt.x,
			y: evt.y
		}));
	});
	function showInfo(pt) {
		document.getElementById("scaleDisplay").textContent = "比例尺：1:" + Math.round(view.scale * 1) / 1;
		document.getElementById("coordinateDisplay").textContent = "经度为：" + pt.latitude.toFixed(3) + "  纬度为：" + pt.longitude
			.toFixed(3);
	}
	////////////////////联动////////////////////////////
	/**
	 * utility method that synchronizes the viewpoint of a view to other views
	 */
	var synchronizeView = function(view, others) {
		others = Array.isArray(others) ? others : [others];
		var viewpointWatchHandle;
		var viewStationaryHandle;
		var otherInteractHandlers;
		var scheduleId;
		var clear = function() {
			if (otherInteractHandlers) {
				otherInteractHandlers.forEach(function(handle) {
					handle.remove();
				});
			}
			viewpointWatchHandle && viewpointWatchHandle.remove();
			viewStationaryHandle && viewStationaryHandle.remove();
			scheduleId && clearTimeout(scheduleId);
			otherInteractHandlers = viewpointWatchHandle =
				viewStationaryHandle = scheduleId = null;
		};
		var interactWatcher = view.watch('interacting,animation',
			function(newValue) {
				if (!newValue) {
					return;
				}
				if (viewpointWatchHandle || scheduleId) {
					return;
				}
				// start updating the other views at the next frame
				scheduleId = setTimeout(function() {
					scheduleId = null;
					viewpointWatchHandle = view.watch('viewpoint',
						function(newValue) {
							others.forEach(function(otherView) {
								otherView.viewpoint = newValue;
							});
						});
				}, 0);
				// stop as soon as another view starts interacting, like if the user starts panning
				otherInteractHandlers = others.map(function(otherView) {
					return watchUtils.watch(otherView,
						'interacting,animation',
						function(
							value) {
							if (value) {
								clear();
							}
						});
				});
				// or stop when the view is stationary again
				viewStationaryHandle = watchUtils.whenTrue(view,
					'stationary', clear);
			});
		return {
			remove: function() {
				this.remove = function() {};
				clear();
				interactWatcher.remove();
			}
		}
	};
	/**
	 * utility method that synchronizes the viewpoints of multiple views
	 */
	var synchronizeViews = function(views) {
		var handles = views.map(function(view, idx, views) {
			var others = views.concat();
			others.splice(idx, 1);
			return synchronizeView(view, others);
		});
		return {
			remove: function() {
				this.remove = function() {};
				handles.forEach(function(h) {
					h.remove();
				});
				handles = null;
			}
		}
	}
	// bind the views
	synchronizeViews([view, view2]);
	/////////////////卷帘////////////////////////////////////////
	//status=1是垂直卷帘，2是水平卷帘，3是都有
	var status = 0;
	var verticalToggle = document.getElementById("vertical");
	verticalToggle.addEventListener("change", function(event) {
		if (verticalToggle.checked == true) {
			styleChange();
			status += 1;
		} else {
			status -= 1;
			if (status == 0) {
				location.reload([false]);
			}
		}
	});
	var levelToggle = document.getElementById("level");
	levelToggle.addEventListener("change", function(event) {
		if (levelToggle.checked == true) {
			styleChange();
			status += 2;
		} else {
			status -= 2;
			if (status == 0) {
				location.reload([false]);
			}
		}
	});
	view.on('pointer-move', function(e) {
		if (status == 1) {
			verticalSwipt();
		}
		if (status == 2) {
			levelSwipe();
		}
		if (status == 3) {
			bothSwipe();
		}
	});
	view2.on('pointer-move', function(e) {
		if (status == 1) {
			verticalSwipt();
		}
		if (status == 2) {
			levelSwipe();
		}
		if (status == 3) {
			bothSwipe();
		}
	});
	function styleChange() {
		document.getElementById("viewDiv").style.width = "100%";
		document.getElementById("view2Div").style.width = "100%";
		document.getElementById("view2Div").style.left = "0";
	}
	function verticalSwipt() {
		var x = event.screenX;
		document.getElementById("view2Div").style.clip = 'rect(-10000px,10000px,1000000px,' + x + 'px)';
	}
	function levelSwipe() {
		var y = event.screenY - 105;
		document.getElementById("view2Div").style.clip = 'rect(-10000px,10000px,' + y + 'px,-10000px)';
	}
	function bothSwipe() {
		var x = event.screenX;
		var y = event.screenY - 105;
		document.getElementById("view2Div").style.clip = 'rect(-10000px,10000px,' + y + 'px,' + x + 'px)';
	}
});
