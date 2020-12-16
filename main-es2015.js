(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["main"],{

/***/ "+6+M":
/*!***************************************************!*\
  !*** ./src/app/services/objecthandler.service.ts ***!
  \***************************************************/
/*! exports provided: ObjecthandlerService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ObjecthandlerService", function() { return ObjecthandlerService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _draw_line_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./draw-line.service */ "gDD4");
/* harmony import */ var _draw_polygon_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./draw-polygon.service */ "unr1");




class ObjecthandlerService {
    // ---------------------------------
    constructor(ctx, type = "line") {
        this.ctx = ctx;
        this.type = type;
        this.objs = [];
        this.ax = 1.0;
        this.ay = 1.0;
        this.activeIdx = 0;
        switch (this.type) {
            case "polygon":
                this.objs.push(new _draw_polygon_service__WEBPACK_IMPORTED_MODULE_2__["PolygonService"](this.ctx, this.ax, this.ay));
                break;
            case "line":
                this.objs.push(new _draw_line_service__WEBPACK_IMPORTED_MODULE_1__["LineService"](this.ctx, this.ax, this.ay));
                break;
        }
    }
    // ---------------------------------
    add() {
        this.activeIdx += 1;
        switch (this.type) {
            case "polygon":
                this.objs.push(new _draw_polygon_service__WEBPACK_IMPORTED_MODULE_2__["PolygonService"](this.ctx, this.ax, this.ay));
                break;
            case "line":
                this.objs.push(new _draw_line_service__WEBPACK_IMPORTED_MODULE_1__["LineService"](this.ctx, this.ax, this.ay));
                break;
        }
    }
    // ---------------------------------
    available() {
        if (this.objs.length > 0) {
            return true;
        }
        return false;
    }
    // ---------------------------------
    updateScaleFactors(ax, ay) {
        this.ax = ax;
        this.ay = ay;
        this.objs.forEach(function (polygon, index) {
            polygon.setScaleFactors(ax, ay);
            polygon.update();
        });
    }
    // ---------------------------------
    remove() {
        if (this.objs.length > 0) {
            this.objs.pop();
            this.activeIdx -= 1;
        }
        // To avoid an empty list
        if (this.objs.length == 0)
            this.add();
    }
    // ---------------------------------
    getCurrentActive() {
        return this.objs[this.activeIdx];
    }
}
ObjecthandlerService.ɵfac = function ObjecthandlerService_Factory(t) { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinvalidFactory"](); };
ObjecthandlerService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: ObjecthandlerService, factory: ObjecthandlerService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](ObjecthandlerService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: CanvasRenderingContext2D }, { type: undefined }]; }, null); })();


/***/ }),

/***/ 0:
/*!***************************!*\
  !*** multi ./src/main.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! /home/cpeeren/projects/90_haus/RenovierungHaus/src/main.ts */"zUnb");


/***/ }),

/***/ "AytR":
/*!*****************************************!*\
  !*** ./src/environments/environment.ts ***!
  \*****************************************/
/*! exports provided: environment */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "environment", function() { return environment; });
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
const environment = {
    production: false
};
/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.


/***/ }),

/***/ "Sy1n":
/*!**********************************!*\
  !*** ./src/app/app.component.ts ***!
  \**********************************/
/*! exports provided: AppComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppComponent", function() { return AppComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @ng-bootstrap/ng-bootstrap */ "1kSV");
/* harmony import */ var _components_polygon_drawer_polygon_drawer_component__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/polygon-drawer/polygon-drawer.component */ "jzqV");




class AppComponent {
    constructor() {
        this.title = 'smartArchitecture';
    }
}
AppComponent.ɵfac = function AppComponent_Factory(t) { return new (t || AppComponent)(); };
AppComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: AppComponent, selectors: [["app-root"]], decls: 19, vars: 0, consts: [[1, "navbar", "navbar-expand-lg", "navbar-light", "bg-light"], ["href", "#", 1, "navbar-brand"], ["type", "button", "data-toggle", "collapse", "data-target", "#navbarNavAltMarkup", "aria-controls", "navbarNavAltMarkup", "aria-expanded", "false", "aria-label", "Toggle navigation", 1, "navbar-toggler"], [1, "navbar-toggler-icon"], ["id", "navbarNavAltMarkup", 1, "collapse", "navbar-collapse"], [1, "navbar-nav"], [1, "container"], ["id", "nav-tab", "role", "tablist", 1, "nav", "nav-tabs"], ["id", "nav-home-tab", "data-toggle", "tab", "href", "#nav-home", "role", "tab", "aria-controls", "nav-home", "aria-selected", "true", 1, "nav-item", "nav-link", "active"], ["id", "nav-profile-tab", "data-toggle", "tab", "href", "#nav-profile", "role", "tab", "aria-controls", "nav-profile", "aria-selected", "false", 1, "nav-item", "nav-link"], ["id", "nav-tabContent", 1, "tab-content"], ["id", "nav-home", "role", "tabpanel", "aria-labelledby", "nav-home-tab", 1, "tab-pane", "fade", "show", "active"], ["name", "Basement", "imagePath", "../assets/basement.jpg"], ["id", "nav-profile", "role", "tabpanel", "aria-labelledby", "nav-profile-tab", 1, "tab-pane", "fade"], ["name", "FirstFloor", "imagePath", "../assets/first.jpg"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "nav", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "a", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "SmartArchitecture");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "button", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](4, "span", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](6, "div", 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](7, "div", 6);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](8, "nav");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](9, "div", 7);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](10, "a", 8);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](11, "Basement");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](12, "a", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](13, "First Floor");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](14, "div", 10);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](15, "div", 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](16, "app-polygon-drawer", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](17, "div", 13);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](18, "app-polygon-drawer", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } }, directives: [_ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_1__["NgbNavbar"], _components_polygon_drawer_polygon_drawer_component__WEBPACK_IMPORTED_MODULE_2__["PolygonDrawerComponent"]], styles: ["\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsImZpbGUiOiJzcmMvYXBwL2FwcC5jb21wb25lbnQuY3NzIn0= */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](AppComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-root',
                templateUrl: './app.component.html',
                styleUrls: ['./app.component.css']
            }]
    }], null, null); })();


/***/ }),

/***/ "WJxd":
/*!******************************************************!*\
  !*** ./src/app/services/draw-measurement.service.ts ***!
  \******************************************************/
/*! exports provided: DrawMeasurementService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DrawMeasurementService", function() { return DrawMeasurementService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");


class DrawMeasurementService {
    constructor(ctx, color = "#7CFC00", direction = "x", name = "principal") {
        this.ctx = ctx;
        this.color = color;
        this.direction = direction;
        this.name = name;
        this.principalLength = 1.0;
        this.principalAxis = [];
        this.principalAxisSet = false;
        this.scaleFactor = 1.0;
        try {
            var _settings = JSON.parse(localStorage.getItem('principal_' + this.name + "_" + this.direction));
            this.principalAxisSet = _settings.principalAxisSet;
            this.principalAxis = _settings.axis;
            this.selectionDone();
            this.draw();
        }
        catch (e) { }
        ;
    }
    // -----------------------------
    addPoint(x, y) {
        if (this.principalAxisSet) {
            return;
        }
        if (this.principalAxis.length < 2)
            this.principalAxis.push([x, y]);
        if (this.principalAxis.length == 2)
            this.selectionDone();
    }
    // -----------------------------
    setPrincipalLength(val) {
        this.principalLength = val;
    }
    // -----------------------------
    reset() {
        this.principalAxis = [];
        this.principalLength = 1.0;
        this.principalAxisSet = false;
        this.scaleFactor = 1.0;
        this._store2session();
    }
    // -----------------------------
    selectionDone() {
        if (this.principalAxis.length == 2) {
            var ds = 1.0;
            switch (this.direction) {
                case "x":
                    this.principalAxis[1][1] = this.principalAxis[0][1];
                    ds = Math.abs(this.principalAxis[1][0] - this.principalAxis[0][0]);
                    break;
                case "y":
                    this.principalAxis[1][0] = this.principalAxis[0][0];
                    ds = Math.abs(this.principalAxis[1][1] - this.principalAxis[0][1]);
                    break;
            }
            ;
            // Calculate scale factor [m/pixels]
            this.scaleFactor = this.principalLength / ds;
            this.principalAxisSet = true;
            this._store2session();
            console.log("Principal axis set!");
        }
    }
    // -----------------------------
    draw() {
        if (this.principalAxis.length > 0) {
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.principalAxis[0][0], this.principalAxis[0][1]);
            this.ctx.fillRect(this.principalAxis[0][0], this.principalAxis[0][1], 1, 1);
            for (var i = 1; i < this.principalAxis.length; i += 1) {
                this.ctx.lineTo(this.principalAxis[i][0], this.principalAxis[i][1]);
                this.ctx.fillRect(this.principalAxis[i][0], this.principalAxis[i][1], 1, 1);
            }
            this.ctx.stroke();
        }
    }
    // -----------------------------
    _store2session() {
        // Store axis to session
        var _settings = {
            axis: this.principalAxis,
            principalAxisSet: true,
        };
        localStorage.setItem('principal_' + this.name + "_" + this.direction, JSON.stringify(_settings));
    }
}
DrawMeasurementService.ɵfac = function DrawMeasurementService_Factory(t) { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinvalidFactory"](); };
DrawMeasurementService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: DrawMeasurementService, factory: DrawMeasurementService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](DrawMeasurementService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: CanvasRenderingContext2D }, { type: undefined }, { type: undefined }, { type: undefined }]; }, null); })();


/***/ }),

/***/ "ZAI4":
/*!*******************************!*\
  !*** ./src/app/app.module.ts ***!
  \*******************************/
/*! exports provided: AppModule */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppModule", function() { return AppModule; });
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_forms__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/forms */ "3Pt+");
/* harmony import */ var _ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @ng-bootstrap/ng-bootstrap */ "1kSV");
/* harmony import */ var _app_routing_module__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./app-routing.module */ "vY5A");
/* harmony import */ var _app_component__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./app.component */ "Sy1n");
/* harmony import */ var _components_polygon_drawer_polygon_drawer_component__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./components/polygon-drawer/polygon-drawer.component */ "jzqV");








class AppModule {
}
AppModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineNgModule"]({ type: AppModule, bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_5__["AppComponent"]] });
AppModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineInjector"]({ factory: function AppModule_Factory(t) { return new (t || AppModule)(); }, providers: [], imports: [[
            _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
            _app_routing_module__WEBPACK_IMPORTED_MODULE_4__["AppRoutingModule"],
            _ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_3__["NgbModule"],
            _angular_forms__WEBPACK_IMPORTED_MODULE_2__["FormsModule"]
        ]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵsetNgModuleScope"](AppModule, { declarations: [_app_component__WEBPACK_IMPORTED_MODULE_5__["AppComponent"],
        _components_polygon_drawer_polygon_drawer_component__WEBPACK_IMPORTED_MODULE_6__["PolygonDrawerComponent"]], imports: [_angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
        _app_routing_module__WEBPACK_IMPORTED_MODULE_4__["AppRoutingModule"],
        _ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_3__["NgbModule"],
        _angular_forms__WEBPACK_IMPORTED_MODULE_2__["FormsModule"]] }); })();
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵsetClassMetadata"](AppModule, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_1__["NgModule"],
        args: [{
                declarations: [
                    _app_component__WEBPACK_IMPORTED_MODULE_5__["AppComponent"],
                    _components_polygon_drawer_polygon_drawer_component__WEBPACK_IMPORTED_MODULE_6__["PolygonDrawerComponent"]
                ],
                imports: [
                    _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
                    _app_routing_module__WEBPACK_IMPORTED_MODULE_4__["AppRoutingModule"],
                    _ng_bootstrap_ng_bootstrap__WEBPACK_IMPORTED_MODULE_3__["NgbModule"],
                    _angular_forms__WEBPACK_IMPORTED_MODULE_2__["FormsModule"]
                ],
                providers: [],
                bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_5__["AppComponent"]]
            }]
    }], null, null); })();


/***/ }),

/***/ "gDD4":
/*!***********************************************!*\
  !*** ./src/app/services/draw-line.service.ts ***!
  \***********************************************/
/*! exports provided: LineService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "LineService", function() { return LineService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");


class LineService {
    constructor(ctx, ax = 1.0, ay = 1.0) {
        this.ctx = ctx;
        this.ax = ax;
        this.ay = ay;
        this.points = [];
        this.pointsReal = [];
        this.done = false;
        this.initialized = false;
        this.pointSize = 5;
        this.length = 0.0;
        var r = Math.floor(Math.random() * 255);
        var g = Math.floor(Math.random() * 255);
        var b = Math.floor(Math.random() * 255);
        this.color = "rgb(" + r + " ," + g + ", " + b + ")";
    }
    addPoint(x, y) {
        this.points.push([x, y]);
        this.initialized = true;
    }
    // -----------------------------
    draw() {
        if (this.initialized) {
            this.ctx.strokeStyle = this.color;
            this.ctx.fillStyle = this.color;
            this.ctx.setLineDash([]);
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0][0], this.points[0][1]);
            this.ctx.fillRect(this.points[0][0], this.points[0][1], this.pointSize, this.pointSize);
            for (var i = 1; i < this.points.length; i += 1) {
                this.ctx.lineTo(this.points[i][0], this.points[i][1]);
                this.ctx.fillRect(this.points[i][0], this.points[i][1], this.pointSize, this.pointSize);
            }
            if (this.done) {
                var mean = this._calcMean();
                this.ctx.fillStyle = "rgb(0,0,0)";
                this.ctx.font = "20px Arial";
                this.ctx.fillText(this.length.toFixed(2) + "m", mean[0], mean[1]);
            }
            this.ctx.stroke();
        }
    }
    // -----------------------------
    selectionDone() {
        this.done = true;
        this.update();
    }
    // -----------------------------
    reset() {
        this.initialized = false;
        this.points = [];
    }
    // -----------------------------
    getVertices() {
        return this.pointsReal;
    }
    // -----------------------------
    setScaleFactors(ax, ay) {
        this.ax = ax;
        this.ay = ay;
        console.log(ax, ay);
    }
    // -----------------------------
    update() {
        if (this.done) {
            this._calcLineInRealUnit();
            this.length = this._calcLineLength();
        }
    }
    // -----------------------------
    _calcLineInRealUnit() {
        this.pointsReal = [];
        for (var i = 0, l = this.points.length; i < l; i++) {
            this.pointsReal.push([this.points[i][0] * this.ax, this.points[i][1] * this.ay]);
        }
    }
    ;
    // -----------------------------
    _calcLineLength() {
        var total = 0;
        for (var i = 0, l = this.pointsReal.length; i < l - 1; i++) {
            var dx = this.pointsReal[i + 1][0] - this.pointsReal[i][0];
            var dy = this.pointsReal[i + 1][1] - this.pointsReal[i][1];
            var ds = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
            total += ds;
        }
        return total;
    }
    // -----------------------------
    _calcMean() {
        var mean = [0.0, 0.0];
        var npts = this.points.length;
        this.points.forEach(function (point, index) {
            mean[0] += point[0] / npts;
            mean[1] += point[1] / npts;
        });
        return mean;
    }
}
LineService.ɵfac = function LineService_Factory(t) { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinvalidFactory"](); };
LineService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: LineService, factory: LineService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](LineService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: CanvasRenderingContext2D }, { type: undefined }, { type: undefined }]; }, null); })();


/***/ }),

/***/ "jzqV":
/*!***********************************************************************!*\
  !*** ./src/app/components/polygon-drawer/polygon-drawer.component.ts ***!
  \***********************************************************************/
/*! exports provided: PolygonDrawerComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "PolygonDrawerComponent", function() { return PolygonDrawerComponent; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _services_objecthandler_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/objecthandler.service */ "+6+M");
/* harmony import */ var _services_draw_measurement_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../services/draw-measurement.service */ "WJxd");
/* harmony import */ var _angular_forms__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/forms */ "3Pt+");





const _c0 = ["canvas"];
class PolygonDrawerComponent {
    // ---------------------------------
    constructor() {
        this.image = new Image();
        this.name = "basement";
        this.imagePath = "../assets/basement.jpg";
        this.height = 1200;
        this.width = 800;
        this.dx = 1.0;
        this.dy = 1.0;
        this.selectionMode = "principalx";
    }
    // ---------------------------------
    ngOnInit() {
        // Canvas Polygon and Image
        this.ctx = this.canvas.nativeElement.getContext('2d');
        this.polygonDrawer = new _services_objecthandler_service__WEBPACK_IMPORTED_MODULE_1__["ObjecthandlerService"](this.ctx, "polygon");
        this.lineDrawer = new _services_objecthandler_service__WEBPACK_IMPORTED_MODULE_1__["ObjecthandlerService"](this.ctx, "line");
        // Principal Axis
        this.principalx = new _services_draw_measurement_service__WEBPACK_IMPORTED_MODULE_2__["DrawMeasurementService"](this.ctx, "#7CFC00", "x", this.name);
        this.principaly = new _services_draw_measurement_service__WEBPACK_IMPORTED_MODULE_2__["DrawMeasurementService"](this.ctx, "#FF0000", "y", this.name);
        try {
            var _settings = JSON.parse(localStorage.getItem('sketcher_' + this.name));
            this.dx = _settings.dx;
            this.dy = _settings.dy;
            this.principalx.setPrincipalLength(this.dx);
            this.principaly.setPrincipalLength(this.dy);
            this.principalx.selectionDone();
            this.principaly.selectionDone();
            this.polygonDrawer.updateScaleFactors(this.principalx.scaleFactor, this.principaly.scaleFactor);
            this.lineDrawer.updateScaleFactors(this.principalx.scaleFactor, this.principaly.scaleFactor);
        }
        catch (e) { }
        ;
        // Load background image for canvas
        this._reloadImage();
    }
    // ---------------------------------
    onRightClick(event) {
        event.preventDefault();
        switch (this.selectionMode) {
            case "line":
                var obj = this.lineDrawer.getCurrentActive();
                this.lineDrawer.add();
                break;
            case "polygon":
                var obj = this.polygonDrawer.getCurrentActive();
                this.polygonDrawer.add();
                break;
            case "principalx":
                var obj = this.principalx;
                break;
            case "principaly":
                var obj = this.principaly;
                break;
        }
        obj.selectionDone();
        obj.draw();
    }
    // ---------------------------------
    onLengthChange() {
        this.principalx.setPrincipalLength(this.dx);
        this.principaly.setPrincipalLength(this.dy);
        this.principalx.selectionDone();
        this.principaly.selectionDone();
        this._store2session();
        this.polygonDrawer.updateScaleFactors(this.principalx.scaleFactor, this.principaly.scaleFactor);
        this.lineDrawer.updateScaleFactors(this.principalx.scaleFactor, this.principaly.scaleFactor);
        this._reloadImage();
    }
    // ---------------------------------
    onLeftClick(event) {
        // Modern browser's now handle this for you. Chrome, IE9, and Firefox
        // support the offsetX/Y like this, passing in the event from the click handler.
        // https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
        console.log(this.selectionMode);
        var x = parseInt(event.offsetX);
        var y = parseInt(event.offsetY);
        switch (this.selectionMode) {
            case "principalx":
                this.principalx.addPoint(x, y);
                this.principalx.draw();
                break;
            case "principaly":
                this.principaly.addPoint(x, y);
                this.principaly.draw();
                break;
            case "polygon":
                var polygon = this.polygonDrawer.getCurrentActive();
                polygon.addPoint(x, y);
                polygon.draw();
                break;
            case "line":
                var line = this.lineDrawer.getCurrentActive();
                line.addPoint(x, y);
                line.draw();
                break;
        }
    }
    // ---------------------------------
    _reloadImage() {
        this.image.onload = () => {
            this.ctx.drawImage(this.image, 0, 0, this.width, this.height);
            this.principalx.draw();
            this.principaly.draw();
            this.polygonDrawer.objs.forEach(function (polygon, index) {
                polygon.draw();
            });
            this.lineDrawer.objs.forEach(function (line, index) {
                line.draw();
            });
        };
        this.image.src = this.imagePath;
    }
    // ---------------------------------
    remove() {
        switch (this.selectionMode) {
            case "principalx":
                this.principalx.reset();
                console.log("X axis removed!");
                break;
            case "principaly":
                this.principaly.reset();
                console.log("Y axis removed!");
                break;
            case "polygon":
                this.polygonDrawer.remove();
                console.log("Polygon removed!");
                break;
            case "line":
                this.lineDrawer.remove();
                console.log("Line removed!");
                break;
        }
        this._reloadImage();
    }
    // -----------------------------
    _store2session() {
        // Store axis to session
        var _settings = {
            dx: this.dx,
            dy: this.dy,
        };
        localStorage.setItem('sketcher_' + this.name, JSON.stringify(_settings));
    }
}
PolygonDrawerComponent.ɵfac = function PolygonDrawerComponent_Factory(t) { return new (t || PolygonDrawerComponent)(); };
PolygonDrawerComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: PolygonDrawerComponent, selectors: [["app-polygon-drawer"]], viewQuery: function PolygonDrawerComponent_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstaticViewQuery"](_c0, true);
    } if (rf & 2) {
        var _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.canvas = _t.first);
    } }, inputs: { name: "name", imagePath: "imagePath" }, decls: 29, vars: 6, consts: [[1, "card", "mb-3"], [1, "card-body"], [1, "card-title"], [1, "input-group", "mb-3"], [1, "input-group-prepend"], ["id", "selectionType", 1, "input-group-text"], ["id", "typeselection", 3, "ngModel", "ngModelChange"], ["value", "principalx"], ["value", "principaly"], ["value", "polygon"], ["value", "line"], ["id", "scalex", 1, "input-group-text"], ["type", "number", "min", "0.01", "step", "0.01", 3, "ngModel", "ngModelChange", "change"], ["id", "scaley", 1, "input-group-text"], ["id", "send-btn", 1, "btn", "btn-danger", 3, "click"], [1, "center", 2, "cursor", "crosshair", 3, "width", "height", "click", "contextmenu"], ["canvas", ""]], template: function PolygonDrawerComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "h5", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "div", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](5, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](6, "span", 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](7, "Mode");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](8, "select", 6);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("ngModelChange", function PolygonDrawerComponent_Template_select_ngModelChange_8_listener($event) { return ctx.selectionMode = $event; });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](9, "option", 7);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](10, "Principal X");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](11, "option", 8);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](12, "Principal Y");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](13, "option", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](14, "Area");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](15, "option", 10);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](16, "Length");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](17, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](18, "span", 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](19, "Ref X");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](20, "input", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("ngModelChange", function PolygonDrawerComponent_Template_input_ngModelChange_20_listener($event) { return ctx.dx = $event; })("change", function PolygonDrawerComponent_Template_input_change_20_listener() { return ctx.onLengthChange(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](21, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](22, "span", 13);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](23, "Ref Y");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](24, "input", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("ngModelChange", function PolygonDrawerComponent_Template_input_ngModelChange_24_listener($event) { return ctx.dy = $event; })("change", function PolygonDrawerComponent_Template_input_change_24_listener() { return ctx.onLengthChange(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](25, "button", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function PolygonDrawerComponent_Template_button_click_25_listener() { return ctx.remove(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](26, "Remove");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](27, "canvas", 15, 16);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function PolygonDrawerComponent_Template_canvas_click_27_listener($event) { return ctx.onLeftClick($event); })("contextmenu", function PolygonDrawerComponent_Template_canvas_contextmenu_27_listener($event) { return ctx.onRightClick($event); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx.name);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](5);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngModel", ctx.selectionMode);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](12);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngModel", ctx.dx);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngModel", ctx.dy);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("width", ctx.width)("height", ctx.height);
    } }, directives: [_angular_forms__WEBPACK_IMPORTED_MODULE_3__["SelectControlValueAccessor"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["NgControlStatus"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["NgModel"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["NgSelectOption"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["ɵangular_packages_forms_forms_x"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["NumberValueAccessor"], _angular_forms__WEBPACK_IMPORTED_MODULE_3__["DefaultValueAccessor"]], styles: [".center[_ngcontent-%COMP%] {\n    display: block;\n    margin-left: auto;\n    margin-right: auto;\n  }\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9hcHAvY29tcG9uZW50cy9wb2x5Z29uLWRyYXdlci9wb2x5Z29uLWRyYXdlci5jb21wb25lbnQuY3NzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0lBQ0ksY0FBYztJQUNkLGlCQUFpQjtJQUNqQixrQkFBa0I7RUFDcEIiLCJmaWxlIjoic3JjL2FwcC9jb21wb25lbnRzL3BvbHlnb24tZHJhd2VyL3BvbHlnb24tZHJhd2VyLmNvbXBvbmVudC5jc3MiLCJzb3VyY2VzQ29udGVudCI6WyIuY2VudGVyIHtcbiAgICBkaXNwbGF5OiBibG9jaztcbiAgICBtYXJnaW4tbGVmdDogYXV0bztcbiAgICBtYXJnaW4tcmlnaHQ6IGF1dG87XG4gIH0iXX0= */"] });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](PolygonDrawerComponent, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"],
        args: [{
                selector: 'app-polygon-drawer',
                templateUrl: './polygon-drawer.component.html',
                styleUrls: ['./polygon-drawer.component.css']
            }]
    }], function () { return []; }, { canvas: [{
            type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["ViewChild"],
            args: ['canvas', { static: true }]
        }], name: [{
            type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Input"]
        }], imagePath: [{
            type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Input"]
        }] }); })();


/***/ }),

/***/ "unr1":
/*!**************************************************!*\
  !*** ./src/app/services/draw-polygon.service.ts ***!
  \**************************************************/
/*! exports provided: PolygonService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "PolygonService", function() { return PolygonService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");


class PolygonService {
    constructor(ctx, ax = 1.0, ay = 1.0) {
        this.ctx = ctx;
        this.ax = ax;
        this.ay = ay;
        this.points = [];
        this.pointsReal = [];
        this.initialized = false;
        this.done = false;
        this.pointSize = 5;
        this.area = 0.0;
        var r = Math.floor(Math.random() * 255);
        var g = Math.floor(Math.random() * 255);
        var b = Math.floor(Math.random() * 255);
        this.color = "rgb(" + r + " ," + g + ", " + b + ")";
        this.colorFill = "rgb(" + r + " ," + g + ", " + b + ", 0.4)";
    }
    addPoint(x, y) {
        this.points.push([x, y]);
        this.initialized = true;
    }
    // -----------------------------
    draw() {
        if (this.initialized) {
            this.ctx.strokeStyle = this.color;
            this.ctx.fillStyle = this.color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 15]);
            this.ctx.moveTo(this.points[0][0], this.points[0][1]);
            this.ctx.fillRect(this.points[0][0], this.points[0][1], this.pointSize, this.pointSize);
            for (var i = 1; i < this.points.length; i += 1) {
                this.ctx.lineTo(this.points[i][0], this.points[i][1]);
                this.ctx.fillRect(this.points[i][0], this.points[i][1], this.pointSize, this.pointSize);
            }
            this.ctx.stroke();
            if (this.done) {
                this.ctx.fillStyle = this.colorFill;
                this.ctx.beginPath();
                this.ctx.moveTo(this.points[0][0], this.points[0][1]);
                for (var i = 1; i < this.points.length; i += 1) {
                    this.ctx.lineTo(this.points[i][0], this.points[i][1]);
                }
                this.ctx.closePath();
                this.ctx.fill();
                var mean = this._calcMean();
                this.ctx.fillStyle = "rgb(0,0,0)";
                this.ctx.font = "20px Arial";
                this.ctx.fillText(this.area.toFixed(2) + "m2", mean[0], mean[1]);
            }
        }
    }
    // -----------------------------
    selectionDone() {
        this.done = true;
        this.update();
    }
    // -----------------------------
    reset() {
        this.initialized = false;
        this.points = [];
    }
    // -----------------------------
    getVertices() {
        return this.pointsReal;
    }
    // -----------------------------
    setScaleFactors(ax, ay) {
        this.ax = ax;
        this.ay = ay;
        console.log(ax, ay);
    }
    // -----------------------------
    update() {
        if (this.done) {
            this._calcPolygonInRealUnit();
            this.area = this._calcPolygonArea();
        }
    }
    // -----------------------------
    _calcPolygonInRealUnit() {
        this.pointsReal = [];
        for (var i = 0, l = this.points.length; i < l; i++) {
            this.pointsReal.push([this.points[i][0] * this.ax, this.points[i][1] * this.ay]);
        }
    }
    ;
    // -----------------------------
    _calcPolygonArea() {
        var total = 0;
        for (var i = 0, l = this.pointsReal.length; i < l; i++) {
            var addX = this.pointsReal[i][0];
            var addY = this.pointsReal[i == this.pointsReal.length - 1 ? 0 : i + 1][1];
            var subX = this.pointsReal[i == this.pointsReal.length - 1 ? 0 : i + 1][0];
            var subY = this.pointsReal[i][1];
            total += (addX * addY * 0.5);
            total -= (subX * subY * 0.5);
        }
        return Math.abs(total);
    }
    // -----------------------------
    _calcMean() {
        var mean = [0.0, 0.0];
        var npts = this.points.length;
        this.points.forEach(function (point, index) {
            mean[0] += point[0] / npts;
            mean[1] += point[1] / npts;
        });
        return mean;
    }
}
PolygonService.ɵfac = function PolygonService_Factory(t) { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinvalidFactory"](); };
PolygonService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: PolygonService, factory: PolygonService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](PolygonService, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["Injectable"],
        args: [{
                providedIn: 'root'
            }]
    }], function () { return [{ type: CanvasRenderingContext2D }, { type: undefined }, { type: undefined }]; }, null); })();


/***/ }),

/***/ "vY5A":
/*!***************************************!*\
  !*** ./src/app/app-routing.module.ts ***!
  \***************************************/
/*! exports provided: AppRoutingModule */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppRoutingModule", function() { return AppRoutingModule; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/router */ "tyNb");




const routes = [];
class AppRoutingModule {
}
AppRoutingModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineNgModule"]({ type: AppRoutingModule });
AppRoutingModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjector"]({ factory: function AppRoutingModule_Factory(t) { return new (t || AppRoutingModule)(); }, imports: [[_angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"].forRoot(routes)], _angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsetNgModuleScope"](AppRoutingModule, { imports: [_angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"]], exports: [_angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"]] }); })();
/*@__PURE__*/ (function () { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵsetClassMetadata"](AppRoutingModule, [{
        type: _angular_core__WEBPACK_IMPORTED_MODULE_0__["NgModule"],
        args: [{
                imports: [_angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"].forRoot(routes)],
                exports: [_angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterModule"]]
            }]
    }], null, null); })();


/***/ }),

/***/ "zUnb":
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _environments_environment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./environments/environment */ "AytR");
/* harmony import */ var _app_app_module__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./app/app.module */ "ZAI4");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");




if (_environments_environment__WEBPACK_IMPORTED_MODULE_1__["environment"].production) {
    Object(_angular_core__WEBPACK_IMPORTED_MODULE_0__["enableProdMode"])();
}
_angular_platform_browser__WEBPACK_IMPORTED_MODULE_3__["platformBrowser"]().bootstrapModule(_app_app_module__WEBPACK_IMPORTED_MODULE_2__["AppModule"])
    .catch(err => console.error(err));


/***/ }),

/***/ "zn8P":
/*!******************************************************!*\
  !*** ./$$_lazy_route_resource lazy namespace object ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncaught exception popping up in devtools
	return Promise.resolve().then(function() {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = "zn8P";

/***/ })

},[[0,"runtime","vendor"]]]);
//# sourceMappingURL=main-es2015.js.map