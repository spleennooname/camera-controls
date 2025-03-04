/*!
 * camera-controls
 * https://github.com/yomotsu/camera-controls
 * (c) 2017 @yomotsu
 * Released under the MIT License.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.CameraControls = factory());
})(this, (function () { 'use strict';

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */
	/* global Reflect, Promise */

	var extendStatics = function(d, b) {
	    extendStatics = Object.setPrototypeOf ||
	        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
	    return extendStatics(d, b);
	};

	function __extends(d, b) {
	    if (typeof b !== "function" && b !== null)
	        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
	    extendStatics(d, b);
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	var ACTION;
	(function (ACTION) {
	    ACTION[ACTION["NONE"] = 0] = "NONE";
	    ACTION[ACTION["ROTATE"] = 1] = "ROTATE";
	    ACTION[ACTION["TRUCK"] = 2] = "TRUCK";
	    ACTION[ACTION["OFFSET"] = 3] = "OFFSET";
	    ACTION[ACTION["DOLLY"] = 4] = "DOLLY";
	    ACTION[ACTION["ZOOM"] = 5] = "ZOOM";
	    ACTION[ACTION["TOUCH_ROTATE"] = 6] = "TOUCH_ROTATE";
	    ACTION[ACTION["TOUCH_TRUCK"] = 7] = "TOUCH_TRUCK";
	    ACTION[ACTION["TOUCH_OFFSET"] = 8] = "TOUCH_OFFSET";
	    ACTION[ACTION["TOUCH_DOLLY"] = 9] = "TOUCH_DOLLY";
	    ACTION[ACTION["TOUCH_ZOOM"] = 10] = "TOUCH_ZOOM";
	    ACTION[ACTION["TOUCH_DOLLY_TRUCK"] = 11] = "TOUCH_DOLLY_TRUCK";
	    ACTION[ACTION["TOUCH_DOLLY_OFFSET"] = 12] = "TOUCH_DOLLY_OFFSET";
	    ACTION[ACTION["TOUCH_ZOOM_TRUCK"] = 13] = "TOUCH_ZOOM_TRUCK";
	    ACTION[ACTION["TOUCH_ZOOM_OFFSET"] = 14] = "TOUCH_ZOOM_OFFSET";
	})(ACTION || (ACTION = {}));
	function isPerspectiveCamera(camera) {
	    return camera.isPerspectiveCamera;
	}
	function isOrthographicCamera(camera) {
	    return camera.isOrthographicCamera;
	}

	var PI_2 = Math.PI * 2;
	var PI_HALF = Math.PI / 2;

	var EPSILON = 1e-5;
	function approxZero(number, error) {
	    if (error === void 0) { error = EPSILON; }
	    return Math.abs(number) < error;
	}
	function approxEquals(a, b, error) {
	    if (error === void 0) { error = EPSILON; }
	    return approxZero(a - b, error);
	}
	function roundToStep(value, step) {
	    return Math.round(value / step) * step;
	}
	function infinityToMaxNumber(value) {
	    if (isFinite(value))
	        return value;
	    if (value < 0)
	        return -Number.MAX_VALUE;
	    return Number.MAX_VALUE;
	}
	function maxNumberToInfinity(value) {
	    if (Math.abs(value) < Number.MAX_VALUE)
	        return value;
	    return value * Infinity;
	}

	function extractClientCoordFromEvent(pointers, out) {
	    out.set(0, 0);
	    pointers.forEach(function (pointer) {
	        out.x += pointer.clientX;
	        out.y += pointer.clientY;
	    });
	    out.x /= pointers.length;
	    out.y /= pointers.length;
	}

	function notSupportedInOrthographicCamera(camera, message) {
	    if (isOrthographicCamera(camera)) {
	        console.warn("".concat(message, " is not supported in OrthographicCamera"));
	        return true;
	    }
	    return false;
	}

	function quatInvertCompat(target) {
	    if (target.invert) {
	        target.invert();
	    }
	    else {
	        target.inverse();
	    }
	    return target;
	}

	var EventDispatcher = (function () {
	    function EventDispatcher() {
	        this._listeners = {};
	    }
	    EventDispatcher.prototype.addEventListener = function (type, listener) {
	        var listeners = this._listeners;
	        if (listeners[type] === undefined)
	            listeners[type] = [];
	        if (listeners[type].indexOf(listener) === -1)
	            listeners[type].push(listener);
	    };
	    EventDispatcher.prototype.removeEventListener = function (type, listener) {
	        var listeners = this._listeners;
	        var listenerArray = listeners[type];
	        if (listenerArray !== undefined) {
	            var index = listenerArray.indexOf(listener);
	            if (index !== -1)
	                listenerArray.splice(index, 1);
	        }
	    };
	    EventDispatcher.prototype.removeAllEventListeners = function (type) {
	        if (!type) {
	            this._listeners = {};
	            return;
	        }
	        if (Array.isArray(this._listeners[type]))
	            this._listeners[type].length = 0;
	    };
	    EventDispatcher.prototype.dispatchEvent = function (event) {
	        var listeners = this._listeners;
	        var listenerArray = listeners[event.type];
	        if (listenerArray !== undefined) {
	            event.target = this;
	            var array = listenerArray.slice(0);
	            for (var i = 0, l = array.length; i < l; i++) {
	                array[i].call(this, event);
	            }
	        }
	    };
	    return EventDispatcher;
	}());

	var isBrowser = typeof window !== 'undefined';
	var isMac = isBrowser && /Mac/.test(navigator.platform);
	var isPointerEventsNotSupported = !(isBrowser && 'PointerEvent' in window);
	var readonlyACTION = Object.freeze(ACTION);
	var TOUCH_DOLLY_FACTOR = 1 / 8;
	var THREE;
	var _ORIGIN;
	var _AXIS_Y;
	var _AXIS_Z;
	var _v2;
	var _v3A;
	var _v3B;
	var _v3C;
	var _xColumn;
	var _yColumn;
	var _zColumn;
	var _sphericalA;
	var _sphericalB;
	var _box3A;
	var _box3B;
	var _sphere;
	var _quaternionA;
	var _quaternionB;
	var _rotationMatrix;
	var _raycaster;
	var CameraControls = (function (_super) {
	    __extends(CameraControls, _super);
	    function CameraControls(camera, domElement) {
	        var _this = _super.call(this) || this;
	        _this.minPolarAngle = 0;
	        _this.maxPolarAngle = Math.PI;
	        _this.minAzimuthAngle = -Infinity;
	        _this.maxAzimuthAngle = Infinity;
	        _this.minDistance = 0;
	        _this.maxDistance = Infinity;
	        _this.infinityDolly = false;
	        _this.minZoom = 0.01;
	        _this.maxZoom = Infinity;
	        _this.dampingFactor = 0.05;
	        _this.draggingDampingFactor = 0.25;
	        _this.azimuthRotateSpeed = 1.0;
	        _this.polarRotateSpeed = 1.0;
	        _this.dollySpeed = 1.0;
	        _this.truckSpeed = 2.0;
	        _this.dollyToCursor = false;
	        _this.dragToOffset = false;
	        _this.verticalDragToForward = false;
	        _this.boundaryFriction = 0.0;
	        _this.restThreshold = 0.01;
	        _this.colliderMeshes = [];
	        _this.cancel = function () { };
	        _this._enabled = true;
	        _this._state = ACTION.NONE;
	        _this._viewport = null;
	        _this._dollyControlAmount = 0;
	        _this._hasRested = true;
	        _this._boundaryEnclosesCamera = false;
	        _this._needsUpdate = true;
	        _this._updatedLastTime = false;
	        _this._elementRect = new DOMRect();
	        _this._activePointers = [];
	        _this._truckInternal = function (deltaX, deltaY, dragToOffset) {
	            if (isPerspectiveCamera(_this._camera)) {
	                var offset = _v3A.copy(_this._camera.position).sub(_this._target);
	                var fov = _this._camera.getEffectiveFOV() * THREE.MathUtils.DEG2RAD;
	                var targetDistance = offset.length() * Math.tan(fov * 0.5);
	                var truckX = (_this.truckSpeed * deltaX * targetDistance / _this._elementRect.height);
	                var pedestalY = (_this.truckSpeed * deltaY * targetDistance / _this._elementRect.height);
	                if (_this.verticalDragToForward) {
	                    dragToOffset ?
	                        _this.setFocalOffset(_this._focalOffsetEnd.x + truckX, _this._focalOffsetEnd.y, _this._focalOffsetEnd.z, true) :
	                        _this.truck(truckX, 0, true);
	                    _this.forward(-pedestalY, true);
	                }
	                else {
	                    dragToOffset ?
	                        _this.setFocalOffset(_this._focalOffsetEnd.x + truckX, _this._focalOffsetEnd.y + pedestalY, _this._focalOffsetEnd.z, true) :
	                        _this.truck(truckX, pedestalY, true);
	                }
	            }
	            else if (isOrthographicCamera(_this._camera)) {
	                var camera = _this._camera;
	                var truckX = deltaX * (camera.right - camera.left) / camera.zoom / _this._elementRect.width;
	                var pedestalY = deltaY * (camera.top - camera.bottom) / camera.zoom / _this._elementRect.height;
	                dragToOffset ?
	                    _this.setFocalOffset(_this._focalOffsetEnd.x + truckX, _this._focalOffsetEnd.y + pedestalY, _this._focalOffsetEnd.z, true) :
	                    _this.truck(truckX, pedestalY, true);
	            }
	        };
	        _this._rotateInternal = function (deltaX, deltaY) {
	            var theta = PI_2 * _this.azimuthRotateSpeed * deltaX / _this._elementRect.height;
	            var phi = PI_2 * _this.polarRotateSpeed * deltaY / _this._elementRect.height;
	            _this.rotate(theta, phi, true);
	        };
	        _this._dollyInternal = function (delta, x, y) {
	            var dollyScale = Math.pow(0.95, -delta * _this.dollySpeed);
	            var distance = _this._sphericalEnd.radius * dollyScale;
	            var prevRadius = _this._sphericalEnd.radius;
	            var signedPrevRadius = prevRadius * (delta >= 0 ? -1 : 1);
	            _this.dollyTo(distance);
	            if (_this.infinityDolly && (distance < _this.minDistance || _this.maxDistance === _this.minDistance)) {
	                _this._camera.getWorldDirection(_v3A);
	                _this._targetEnd.add(_v3A.normalize().multiplyScalar(signedPrevRadius));
	                _this._target.add(_v3A.normalize().multiplyScalar(signedPrevRadius));
	            }
	            if (_this.dollyToCursor) {
	                _this._dollyControlAmount += _this._sphericalEnd.radius - prevRadius;
	                if (_this.infinityDolly && (distance < _this.minDistance || _this.maxDistance === _this.minDistance)) {
	                    _this._dollyControlAmount -= signedPrevRadius;
	                }
	                _this._dollyControlCoord.set(x, y);
	            }
	            return;
	        };
	        _this._zoomInternal = function (delta, x, y) {
	            var zoomScale = Math.pow(0.95, delta * _this.dollySpeed);
	            _this.zoomTo(_this._zoom * zoomScale);
	            if (_this.dollyToCursor) {
	                _this._dollyControlAmount = _this._zoomEnd;
	                _this._dollyControlCoord.set(x, y);
	            }
	            return;
	        };
	        if (typeof THREE === 'undefined') {
	            console.error('camera-controls: `THREE` is undefined. You must first run `CameraControls.install( { THREE: THREE } )`. Check the docs for further information.');
	        }
	        _this._camera = camera;
	        _this._yAxisUpSpace = new THREE.Quaternion().setFromUnitVectors(_this._camera.up, _AXIS_Y);
	        _this._yAxisUpSpaceInverse = quatInvertCompat(_this._yAxisUpSpace.clone());
	        _this._state = ACTION.NONE;
	        _this._domElement = domElement;
	        _this._domElement.style.touchAction = 'none';
	        _this._target = new THREE.Vector3();
	        _this._targetEnd = _this._target.clone();
	        _this._focalOffset = new THREE.Vector3();
	        _this._focalOffsetEnd = _this._focalOffset.clone();
	        _this._spherical = new THREE.Spherical().setFromVector3(_v3A.copy(_this._camera.position).applyQuaternion(_this._yAxisUpSpace));
	        _this._sphericalEnd = _this._spherical.clone();
	        _this._zoom = _this._camera.zoom;
	        _this._zoomEnd = _this._zoom;
	        _this._nearPlaneCorners = [
	            new THREE.Vector3(),
	            new THREE.Vector3(),
	            new THREE.Vector3(),
	            new THREE.Vector3(),
	        ];
	        _this._updateNearPlaneCorners();
	        _this._boundary = new THREE.Box3(new THREE.Vector3(-Infinity, -Infinity, -Infinity), new THREE.Vector3(Infinity, Infinity, Infinity));
	        _this._target0 = _this._target.clone();
	        _this._position0 = _this._camera.position.clone();
	        _this._zoom0 = _this._zoom;
	        _this._focalOffset0 = _this._focalOffset.clone();
	        _this._dollyControlAmount = 0;
	        _this._dollyControlCoord = new THREE.Vector2();
	        _this.mouseButtons = {
	            left: ACTION.ROTATE,
	            middle: ACTION.DOLLY,
	            right: ACTION.TRUCK,
	            wheel: isPerspectiveCamera(_this._camera) ? ACTION.DOLLY :
	                isOrthographicCamera(_this._camera) ? ACTION.ZOOM :
	                    ACTION.NONE,
	            shiftLeft: ACTION.NONE,
	        };
	        _this.touches = {
	            one: ACTION.TOUCH_ROTATE,
	            two: isPerspectiveCamera(_this._camera) ? ACTION.TOUCH_DOLLY_TRUCK :
	                isOrthographicCamera(_this._camera) ? ACTION.TOUCH_ZOOM_TRUCK :
	                    ACTION.NONE,
	            three: ACTION.TOUCH_TRUCK,
	        };
	        if (_this._domElement) {
	            var dragStartPosition_1 = new THREE.Vector2();
	            var lastDragPosition_1 = new THREE.Vector2();
	            var dollyStart_1 = new THREE.Vector2();
	            var onPointerDown_1 = function (event) {
	                if (!_this._enabled)
	                    return;
	                var pointer = {
	                    pointerId: event.pointerId,
	                    clientX: event.clientX,
	                    clientY: event.clientY,
	                };
	                _this._activePointers.push(pointer);
	                switch (event.button) {
	                    case THREE.MOUSE.LEFT:
	                        _this._state = event.shiftKey ? _this.mouseButtons.shiftLeft : _this.mouseButtons.left;
	                        break;
	                    case THREE.MOUSE.MIDDLE:
	                        _this._state = _this.mouseButtons.middle;
	                        break;
	                    case THREE.MOUSE.RIGHT:
	                        _this._state = _this.mouseButtons.right;
	                        break;
	                }
	                if (event.pointerType === 'touch') {
	                    switch (_this._activePointers.length) {
	                        case 1:
	                            _this._state = _this.touches.one;
	                            break;
	                        case 2:
	                            _this._state = _this.touches.two;
	                            break;
	                        case 3:
	                            _this._state = _this.touches.three;
	                            break;
	                    }
	                }
	                _this._domElement.ownerDocument.removeEventListener('pointermove', onPointerMove_1, { passive: false });
	                _this._domElement.ownerDocument.removeEventListener('pointerup', onPointerUp_1);
	                _this._domElement.ownerDocument.addEventListener('pointermove', onPointerMove_1, { passive: false });
	                _this._domElement.ownerDocument.addEventListener('pointerup', onPointerUp_1);
	                startDragging_1();
	            };
	            var onMouseDown_1 = function (event) {
	                if (!_this._enabled)
	                    return;
	                var pointer = {
	                    pointerId: 0,
	                    clientX: event.clientX,
	                    clientY: event.clientY,
	                };
	                _this._activePointers.push(pointer);
	                switch (event.button) {
	                    case THREE.MOUSE.LEFT:
	                        _this._state = event.shiftKey ? _this.mouseButtons.shiftLeft : _this.mouseButtons.left;
	                        break;
	                    case THREE.MOUSE.MIDDLE:
	                        _this._state = _this.mouseButtons.middle;
	                        break;
	                    case THREE.MOUSE.RIGHT:
	                        _this._state = _this.mouseButtons.right;
	                        break;
	                }
	                _this._domElement.ownerDocument.removeEventListener('mousemove', onMouseMove_1);
	                _this._domElement.ownerDocument.removeEventListener('mouseup', onMouseUp_1);
	                _this._domElement.ownerDocument.addEventListener('mousemove', onMouseMove_1);
	                _this._domElement.ownerDocument.addEventListener('mouseup', onMouseUp_1);
	                startDragging_1();
	            };
	            var onTouchStart_1 = function (event) {
	                if (!_this._enabled)
	                    return;
	                event.preventDefault();
	                Array.prototype.forEach.call(event.changedTouches, function (touch) {
	                    var pointer = {
	                        pointerId: touch.identifier,
	                        clientX: touch.clientX,
	                        clientY: touch.clientY,
	                    };
	                    _this._activePointers.push(pointer);
	                });
	                switch (_this._activePointers.length) {
	                    case 1:
	                        _this._state = _this.touches.one;
	                        break;
	                    case 2:
	                        _this._state = _this.touches.two;
	                        break;
	                    case 3:
	                        _this._state = _this.touches.three;
	                        break;
	                }
	                _this._domElement.ownerDocument.removeEventListener('touchmove', onTouchMove_1, { passive: false });
	                _this._domElement.ownerDocument.removeEventListener('touchend', onTouchEnd_1);
	                _this._domElement.ownerDocument.addEventListener('touchmove', onTouchMove_1, { passive: false });
	                _this._domElement.ownerDocument.addEventListener('touchend', onTouchEnd_1);
	                startDragging_1();
	            };
	            var onPointerMove_1 = function (event) {
	                if (event.cancelable)
	                    event.preventDefault();
	                var pointerId = event.pointerId;
	                var pointer = _this._findPointerById(pointerId);
	                if (!pointer)
	                    return;
	                pointer.clientX = event.clientX;
	                pointer.clientY = event.clientY;
	                dragging_1();
	            };
	            var onMouseMove_1 = function (event) {
	                var pointer = _this._findPointerById(0);
	                if (!pointer)
	                    return;
	                pointer.clientX = event.clientX;
	                pointer.clientY = event.clientY;
	                dragging_1();
	            };
	            var onTouchMove_1 = function (event) {
	                if (event.cancelable)
	                    event.preventDefault();
	                Array.prototype.forEach.call(event.changedTouches, function (touch) {
	                    var pointerId = touch.identifier;
	                    var pointer = _this._findPointerById(pointerId);
	                    if (!pointer)
	                        return;
	                    pointer.clientX = touch.clientX;
	                    pointer.clientY = touch.clientY;
	                });
	                dragging_1();
	            };
	            var onPointerUp_1 = function (event) {
	                var pointerId = event.pointerId;
	                var pointer = _this._findPointerById(pointerId);
	                pointer && _this._activePointers.splice(_this._activePointers.indexOf(pointer), 1);
	                if (event.pointerType === 'touch') {
	                    switch (_this._activePointers.length) {
	                        case 0:
	                            _this._state = ACTION.NONE;
	                            break;
	                        case 1:
	                            _this._state = _this.touches.one;
	                            break;
	                        case 2:
	                            _this._state = _this.touches.two;
	                            break;
	                        case 3:
	                            _this._state = _this.touches.three;
	                            break;
	                    }
	                }
	                else {
	                    _this._state = ACTION.NONE;
	                }
	                endDragging_1();
	            };
	            var onMouseUp_1 = function () {
	                var pointer = _this._findPointerById(0);
	                pointer && _this._activePointers.splice(_this._activePointers.indexOf(pointer), 1);
	                _this._state = ACTION.NONE;
	                endDragging_1();
	            };
	            var onTouchEnd_1 = function (event) {
	                Array.prototype.forEach.call(event.changedTouches, function (touch) {
	                    var pointerId = touch.identifier;
	                    var pointer = _this._findPointerById(pointerId);
	                    pointer && _this._activePointers.splice(_this._activePointers.indexOf(pointer), 1);
	                });
	                switch (_this._activePointers.length) {
	                    case 0:
	                        _this._state = ACTION.NONE;
	                        break;
	                    case 1:
	                        _this._state = _this.touches.one;
	                        break;
	                    case 2:
	                        _this._state = _this.touches.two;
	                        break;
	                    case 3:
	                        _this._state = _this.touches.three;
	                        break;
	                }
	                endDragging_1();
	            };
	            var lastScrollTimeStamp_1 = -1;
	            var onMouseWheel_1 = function (event) {
	                if (!_this._enabled || _this.mouseButtons.wheel === ACTION.NONE)
	                    return;
	                event.preventDefault();
	                if (_this.dollyToCursor ||
	                    _this.mouseButtons.wheel === ACTION.ROTATE ||
	                    _this.mouseButtons.wheel === ACTION.TRUCK) {
	                    var now = performance.now();
	                    if (lastScrollTimeStamp_1 - now < 1000)
	                        _this._getClientRect(_this._elementRect);
	                    lastScrollTimeStamp_1 = now;
	                }
	                var deltaYFactor = isMac ? -1 : -3;
	                var delta = (event.deltaMode === 1) ? event.deltaY / deltaYFactor : event.deltaY / (deltaYFactor * 10);
	                var x = _this.dollyToCursor ? (event.clientX - _this._elementRect.x) / _this._elementRect.width * 2 - 1 : 0;
	                var y = _this.dollyToCursor ? (event.clientY - _this._elementRect.y) / _this._elementRect.height * -2 + 1 : 0;
	                switch (_this.mouseButtons.wheel) {
	                    case ACTION.ROTATE: {
	                        _this._rotateInternal(event.deltaX, event.deltaY);
	                        break;
	                    }
	                    case ACTION.TRUCK: {
	                        _this._truckInternal(event.deltaX, event.deltaY, false);
	                        break;
	                    }
	                    case ACTION.OFFSET: {
	                        _this._truckInternal(event.deltaX, event.deltaY, true);
	                        break;
	                    }
	                    case ACTION.DOLLY: {
	                        _this._dollyInternal(-delta, x, y);
	                        break;
	                    }
	                    case ACTION.ZOOM: {
	                        _this._zoomInternal(-delta, x, y);
	                        break;
	                    }
	                }
	                _this.dispatchEvent({ type: 'control' });
	            };
	            var onContextMenu_1 = function (event) {
	                if (!_this._enabled)
	                    return;
	                event.preventDefault();
	            };
	            var startDragging_1 = function () {
	                if (!_this._enabled)
	                    return;
	                extractClientCoordFromEvent(_this._activePointers, _v2);
	                _this._getClientRect(_this._elementRect);
	                dragStartPosition_1.copy(_v2);
	                lastDragPosition_1.copy(_v2);
	                var isMultiTouch = _this._activePointers.length >= 2;
	                if (isMultiTouch) {
	                    var dx = _v2.x - _this._activePointers[1].clientX;
	                    var dy = _v2.y - _this._activePointers[1].clientY;
	                    var distance = Math.sqrt(dx * dx + dy * dy);
	                    dollyStart_1.set(0, distance);
	                    var x = (_this._activePointers[0].clientX + _this._activePointers[1].clientX) * 0.5;
	                    var y = (_this._activePointers[0].clientY + _this._activePointers[1].clientY) * 0.5;
	                    lastDragPosition_1.set(x, y);
	                }
	                _this.dispatchEvent({ type: 'controlstart' });
	            };
	            var dragging_1 = function () {
	                if (!_this._enabled)
	                    return;
	                extractClientCoordFromEvent(_this._activePointers, _v2);
	                var deltaX = lastDragPosition_1.x - _v2.x;
	                var deltaY = lastDragPosition_1.y - _v2.y;
	                lastDragPosition_1.copy(_v2);
	                switch (_this._state) {
	                    case ACTION.ROTATE:
	                    case ACTION.TOUCH_ROTATE: {
	                        _this._rotateInternal(deltaX, deltaY);
	                        break;
	                    }
	                    case ACTION.DOLLY:
	                    case ACTION.ZOOM: {
	                        var dollyX = _this.dollyToCursor ? (dragStartPosition_1.x - _this._elementRect.x) / _this._elementRect.width * 2 - 1 : 0;
	                        var dollyY = _this.dollyToCursor ? (dragStartPosition_1.y - _this._elementRect.y) / _this._elementRect.height * -2 + 1 : 0;
	                        _this._state === ACTION.DOLLY ?
	                            _this._dollyInternal(deltaY * TOUCH_DOLLY_FACTOR, dollyX, dollyY) :
	                            _this._zoomInternal(deltaY * TOUCH_DOLLY_FACTOR, dollyX, dollyY);
	                        break;
	                    }
	                    case ACTION.TOUCH_DOLLY:
	                    case ACTION.TOUCH_ZOOM:
	                    case ACTION.TOUCH_DOLLY_TRUCK:
	                    case ACTION.TOUCH_ZOOM_TRUCK:
	                    case ACTION.TOUCH_DOLLY_OFFSET:
	                    case ACTION.TOUCH_ZOOM_OFFSET: {
	                        var dx = _v2.x - _this._activePointers[1].clientX;
	                        var dy = _v2.y - _this._activePointers[1].clientY;
	                        var distance = Math.sqrt(dx * dx + dy * dy);
	                        var dollyDelta = dollyStart_1.y - distance;
	                        dollyStart_1.set(0, distance);
	                        var dollyX = _this.dollyToCursor ? (lastDragPosition_1.x - _this._elementRect.x) / _this._elementRect.width * 2 - 1 : 0;
	                        var dollyY = _this.dollyToCursor ? (lastDragPosition_1.y - _this._elementRect.y) / _this._elementRect.height * -2 + 1 : 0;
	                        _this._state === ACTION.TOUCH_DOLLY ||
	                            _this._state === ACTION.TOUCH_DOLLY_TRUCK ||
	                            _this._state === ACTION.TOUCH_DOLLY_OFFSET ?
	                            _this._dollyInternal(dollyDelta * TOUCH_DOLLY_FACTOR, dollyX, dollyY) :
	                            _this._zoomInternal(dollyDelta * TOUCH_DOLLY_FACTOR, dollyX, dollyY);
	                        if (_this._state === ACTION.TOUCH_DOLLY_TRUCK ||
	                            _this._state === ACTION.TOUCH_ZOOM_TRUCK) {
	                            _this._truckInternal(deltaX, deltaY, false);
	                        }
	                        else if (_this._state === ACTION.TOUCH_DOLLY_OFFSET ||
	                            _this._state === ACTION.TOUCH_ZOOM_OFFSET) {
	                            _this._truckInternal(deltaX, deltaY, true);
	                        }
	                        break;
	                    }
	                    case ACTION.TRUCK:
	                    case ACTION.TOUCH_TRUCK: {
	                        _this._truckInternal(deltaX, deltaY, false);
	                        break;
	                    }
	                    case ACTION.OFFSET:
	                    case ACTION.TOUCH_OFFSET: {
	                        _this._truckInternal(deltaX, deltaY, true);
	                        break;
	                    }
	                }
	                _this.dispatchEvent({ type: 'control' });
	            };
	            var endDragging_1 = function () {
	                extractClientCoordFromEvent(_this._activePointers, _v2);
	                lastDragPosition_1.copy(_v2);
	                if (_this._activePointers.length === 0) {
	                    _this._domElement.ownerDocument.removeEventListener('pointermove', onPointerMove_1, { passive: false });
	                    _this._domElement.ownerDocument.removeEventListener('pointerup', onPointerUp_1);
	                    _this._domElement.ownerDocument.removeEventListener('touchmove', onTouchMove_1, { passive: false });
	                    _this._domElement.ownerDocument.removeEventListener('touchend', onTouchEnd_1);
	                    _this.dispatchEvent({ type: 'controlend' });
	                }
	            };
	            _this._domElement.addEventListener('pointerdown', onPointerDown_1);
	            isPointerEventsNotSupported && _this._domElement.addEventListener('mousedown', onMouseDown_1);
	            isPointerEventsNotSupported && _this._domElement.addEventListener('touchstart', onTouchStart_1);
	            _this._domElement.addEventListener('pointercancel', onPointerUp_1);
	            _this._domElement.addEventListener('wheel', onMouseWheel_1, { passive: false });
	            _this._domElement.addEventListener('contextmenu', onContextMenu_1);
	            _this._removeAllEventListeners = function () {
	                _this._domElement.removeEventListener('pointerdown', onPointerDown_1);
	                _this._domElement.removeEventListener('mousedown', onMouseDown_1);
	                _this._domElement.removeEventListener('touchstart', onTouchStart_1);
	                _this._domElement.removeEventListener('pointercancel', onPointerUp_1);
	                _this._domElement.removeEventListener('wheel', onMouseWheel_1, { passive: false });
	                _this._domElement.removeEventListener('contextmenu', onContextMenu_1);
	                _this._domElement.ownerDocument.removeEventListener('pointermove', onPointerMove_1, { passive: false });
	                _this._domElement.ownerDocument.removeEventListener('mousemove', onMouseMove_1);
	                _this._domElement.ownerDocument.removeEventListener('touchmove', onTouchMove_1, { passive: false });
	                _this._domElement.ownerDocument.removeEventListener('pointerup', onPointerUp_1);
	                _this._domElement.ownerDocument.removeEventListener('mouseup', onMouseUp_1);
	                _this._domElement.ownerDocument.removeEventListener('touchend', onTouchEnd_1);
	            };
	            _this.cancel = function () {
	                if (_this._state === ACTION.NONE)
	                    return;
	                _this._state = ACTION.NONE;
	                _this._activePointers.length = 0;
	                endDragging_1();
	            };
	        }
	        _this.update(0);
	        return _this;
	    }
	    CameraControls.install = function (libs) {
	        THREE = libs.THREE;
	        _ORIGIN = Object.freeze(new THREE.Vector3(0, 0, 0));
	        _AXIS_Y = Object.freeze(new THREE.Vector3(0, 1, 0));
	        _AXIS_Z = Object.freeze(new THREE.Vector3(0, 0, 1));
	        _v2 = new THREE.Vector2();
	        _v3A = new THREE.Vector3();
	        _v3B = new THREE.Vector3();
	        _v3C = new THREE.Vector3();
	        _xColumn = new THREE.Vector3();
	        _yColumn = new THREE.Vector3();
	        _zColumn = new THREE.Vector3();
	        _sphericalA = new THREE.Spherical();
	        _sphericalB = new THREE.Spherical();
	        _box3A = new THREE.Box3();
	        _box3B = new THREE.Box3();
	        _sphere = new THREE.Sphere();
	        _quaternionA = new THREE.Quaternion();
	        _quaternionB = new THREE.Quaternion();
	        _rotationMatrix = new THREE.Matrix4();
	        _raycaster = new THREE.Raycaster();
	    };
	    Object.defineProperty(CameraControls, "ACTION", {
	        get: function () {
	            return readonlyACTION;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "camera", {
	        get: function () {
	            return this._camera;
	        },
	        set: function (camera) {
	            this._camera = camera;
	            this.updateCameraUp();
	            this._camera.updateProjectionMatrix();
	            this._updateNearPlaneCorners();
	            this._needsUpdate = true;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "enabled", {
	        get: function () {
	            return this._enabled;
	        },
	        set: function (enabled) {
	            this._enabled = enabled;
	            if (!enabled)
	                this.cancel();
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "active", {
	        get: function () {
	            return !this._hasRested;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "currentAction", {
	        get: function () {
	            return this._state;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "distance", {
	        get: function () {
	            return this._spherical.radius;
	        },
	        set: function (distance) {
	            if (this._spherical.radius === distance &&
	                this._sphericalEnd.radius === distance)
	                return;
	            this._spherical.radius = distance;
	            this._sphericalEnd.radius = distance;
	            this._needsUpdate = true;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "azimuthAngle", {
	        get: function () {
	            return this._spherical.theta;
	        },
	        set: function (azimuthAngle) {
	            if (this._spherical.theta === azimuthAngle &&
	                this._sphericalEnd.theta === azimuthAngle)
	                return;
	            this._spherical.theta = azimuthAngle;
	            this._sphericalEnd.theta = azimuthAngle;
	            this._needsUpdate = true;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "polarAngle", {
	        get: function () {
	            return this._spherical.phi;
	        },
	        set: function (polarAngle) {
	            if (this._spherical.phi === polarAngle &&
	                this._sphericalEnd.phi === polarAngle)
	                return;
	            this._spherical.phi = polarAngle;
	            this._sphericalEnd.phi = polarAngle;
	            this._needsUpdate = true;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(CameraControls.prototype, "boundaryEnclosesCamera", {
	        get: function () {
	            return this._boundaryEnclosesCamera;
	        },
	        set: function (boundaryEnclosesCamera) {
	            this._boundaryEnclosesCamera = boundaryEnclosesCamera;
	            this._needsUpdate = true;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    CameraControls.prototype.addEventListener = function (type, listener) {
	        _super.prototype.addEventListener.call(this, type, listener);
	    };
	    CameraControls.prototype.removeEventListener = function (type, listener) {
	        _super.prototype.removeEventListener.call(this, type, listener);
	    };
	    CameraControls.prototype.rotate = function (azimuthAngle, polarAngle, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.rotateTo(this._sphericalEnd.theta + azimuthAngle, this._sphericalEnd.phi + polarAngle, enableTransition);
	    };
	    CameraControls.prototype.rotateAzimuthTo = function (azimuthAngle, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.rotateTo(this._sphericalEnd.theta + azimuthAngle, this._sphericalEnd.phi, enableTransition);
	    };
	    CameraControls.prototype.rotatePolarTo = function (polarAngle, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.rotateTo(this._sphericalEnd.theta, this._sphericalEnd.phi + polarAngle, enableTransition);
	    };
	    CameraControls.prototype.rotateTo = function (azimuthAngle, polarAngle, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var theta = THREE.MathUtils.clamp(azimuthAngle, this.minAzimuthAngle, this.maxAzimuthAngle);
	        var phi = THREE.MathUtils.clamp(polarAngle, this.minPolarAngle, this.maxPolarAngle);
	        this._sphericalEnd.theta = theta;
	        this._sphericalEnd.phi = phi;
	        this._sphericalEnd.makeSafe();
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._spherical.theta = this._sphericalEnd.theta;
	            this._spherical.phi = this._sphericalEnd.phi;
	        }
	        var resolveImmediately = !enableTransition ||
	            approxEquals(this._spherical.theta, this._sphericalEnd.theta, this.restThreshold) &&
	                approxEquals(this._spherical.phi, this._sphericalEnd.phi, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.dolly = function (distance, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.dollyTo(this._sphericalEnd.radius - distance, enableTransition);
	    };
	    CameraControls.prototype.dollyTo = function (distance, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var lastRadius = this._sphericalEnd.radius;
	        var newRadius = THREE.MathUtils.clamp(distance, this.minDistance, this.maxDistance);
	        var hasCollider = this.colliderMeshes.length >= 1;
	        if (hasCollider) {
	            var maxDistanceByCollisionTest = this._collisionTest();
	            var isCollided = approxEquals(maxDistanceByCollisionTest, this._spherical.radius);
	            var isDollyIn = lastRadius > newRadius;
	            if (!isDollyIn && isCollided)
	                return Promise.resolve();
	            this._sphericalEnd.radius = Math.min(newRadius, maxDistanceByCollisionTest);
	        }
	        else {
	            this._sphericalEnd.radius = newRadius;
	        }
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._spherical.radius = this._sphericalEnd.radius;
	        }
	        var resolveImmediately = !enableTransition || approxEquals(this._spherical.radius, this._sphericalEnd.radius, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.zoom = function (zoomStep, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.zoomTo(this._zoomEnd + zoomStep, enableTransition);
	    };
	    CameraControls.prototype.zoomTo = function (zoom, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        this._zoomEnd = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._zoom = this._zoomEnd;
	        }
	        var resolveImmediately = !enableTransition || approxEquals(this._zoom, this._zoomEnd, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.pan = function (x, y, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        console.warn('`pan` has been renamed to `truck`');
	        return this.truck(x, y, enableTransition);
	    };
	    CameraControls.prototype.truck = function (x, y, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        this._camera.updateMatrix();
	        _xColumn.setFromMatrixColumn(this._camera.matrix, 0);
	        _yColumn.setFromMatrixColumn(this._camera.matrix, 1);
	        _xColumn.multiplyScalar(x);
	        _yColumn.multiplyScalar(-y);
	        var offset = _v3A.copy(_xColumn).add(_yColumn);
	        var to = _v3B.copy(this._targetEnd).add(offset);
	        return this.moveTo(to.x, to.y, to.z, enableTransition);
	    };
	    CameraControls.prototype.forward = function (distance, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        _v3A.setFromMatrixColumn(this._camera.matrix, 0);
	        _v3A.crossVectors(this._camera.up, _v3A);
	        _v3A.multiplyScalar(distance);
	        var to = _v3B.copy(this._targetEnd).add(_v3A);
	        return this.moveTo(to.x, to.y, to.z, enableTransition);
	    };
	    CameraControls.prototype.moveTo = function (x, y, z, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var offset = _v3A.set(x, y, z).sub(this._targetEnd);
	        this._encloseToBoundary(this._targetEnd, offset, this.boundaryFriction);
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._target.copy(this._targetEnd);
	        }
	        var resolveImmediately = !enableTransition ||
	            approxEquals(this._target.x, this._targetEnd.x, this.restThreshold) &&
	                approxEquals(this._target.y, this._targetEnd.y, this.restThreshold) &&
	                approxEquals(this._target.z, this._targetEnd.z, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.fitToBox = function (box3OrObject, enableTransition, _a) {
	        var _b = _a === void 0 ? {} : _a, _c = _b.paddingLeft, paddingLeft = _c === void 0 ? 0 : _c, _d = _b.paddingRight, paddingRight = _d === void 0 ? 0 : _d, _e = _b.paddingBottom, paddingBottom = _e === void 0 ? 0 : _e, _f = _b.paddingTop, paddingTop = _f === void 0 ? 0 : _f;
	        var promises = [];
	        var aabb = box3OrObject.isBox3
	            ? _box3A.copy(box3OrObject)
	            : _box3A.setFromObject(box3OrObject);
	        if (aabb.isEmpty()) {
	            console.warn('camera-controls: fitTo() cannot be used with an empty box. Aborting');
	            Promise.resolve();
	        }
	        var theta = roundToStep(this._sphericalEnd.theta, PI_HALF);
	        var phi = roundToStep(this._sphericalEnd.phi, PI_HALF);
	        promises.push(this.rotateTo(theta, phi, enableTransition));
	        var normal = _v3A.setFromSpherical(this._sphericalEnd).normalize();
	        var rotation = _quaternionA.setFromUnitVectors(normal, _AXIS_Z);
	        var viewFromPolar = approxEquals(Math.abs(normal.y), 1);
	        if (viewFromPolar) {
	            rotation.multiply(_quaternionB.setFromAxisAngle(_AXIS_Y, theta));
	        }
	        var bb = _box3B.makeEmpty();
	        _v3B.copy(aabb.min).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.min).setX(aabb.max.x).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.min).setY(aabb.max.y).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.max).setZ(aabb.min.z).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.min).setZ(aabb.max.z).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.max).setY(aabb.min.y).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.max).setX(aabb.min.x).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        _v3B.copy(aabb.max).applyQuaternion(rotation);
	        bb.expandByPoint(_v3B);
	        rotation.setFromUnitVectors(_AXIS_Z, normal);
	        bb.min.x -= paddingLeft;
	        bb.min.y -= paddingBottom;
	        bb.max.x += paddingRight;
	        bb.max.y += paddingTop;
	        var bbSize = bb.getSize(_v3A);
	        var center = bb.getCenter(_v3B).applyQuaternion(rotation);
	        if (isPerspectiveCamera(this._camera)) {
	            var distance = this.getDistanceToFitBox(bbSize.x, bbSize.y, bbSize.z);
	            promises.push(this.moveTo(center.x, center.y, center.z, enableTransition));
	            promises.push(this.dollyTo(distance, enableTransition));
	            promises.push(this.setFocalOffset(0, 0, 0, enableTransition));
	        }
	        else if (isOrthographicCamera(this._camera)) {
	            var camera = this._camera;
	            var width = camera.right - camera.left;
	            var height = camera.top - camera.bottom;
	            var zoom = Math.min(width / bbSize.x, height / bbSize.y);
	            promises.push(this.moveTo(center.x, center.y, center.z, enableTransition));
	            promises.push(this.zoomTo(zoom, enableTransition));
	            promises.push(this.setFocalOffset(0, 0, 0, enableTransition));
	        }
	        return Promise.all(promises);
	    };
	    CameraControls.prototype.fitTo = function (box3OrObject, enableTransition, fitToOptions) {
	        if (fitToOptions === void 0) { fitToOptions = {}; }
	        console.warn('camera-controls: fitTo() has been renamed to fitToBox()');
	        return this.fitToBox(box3OrObject, enableTransition, fitToOptions);
	    };
	    CameraControls.prototype.fitToSphere = function (sphereOrMesh, enableTransition) {
	        var promises = [];
	        var isSphere = sphereOrMesh instanceof THREE.Sphere;
	        var boundingSphere = isSphere ?
	            _sphere.copy(sphereOrMesh) :
	            createBoundingSphere(sphereOrMesh, _sphere);
	        promises.push(this.moveTo(boundingSphere.center.x, boundingSphere.center.y, boundingSphere.center.z, enableTransition));
	        if (isPerspectiveCamera(this._camera)) {
	            var distanceToFit = this.getDistanceToFitSphere(boundingSphere.radius);
	            promises.push(this.dollyTo(distanceToFit, enableTransition));
	        }
	        else if (isOrthographicCamera(this._camera)) {
	            var width = this._camera.right - this._camera.left;
	            var height = this._camera.top - this._camera.bottom;
	            var diameter = 2 * boundingSphere.radius;
	            var zoom = Math.min(width / diameter, height / diameter);
	            promises.push(this.zoomTo(zoom, enableTransition));
	        }
	        promises.push(this.setFocalOffset(0, 0, 0, enableTransition));
	        return Promise.all(promises);
	    };
	    CameraControls.prototype.setLookAt = function (positionX, positionY, positionZ, targetX, targetY, targetZ, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var target = _v3B.set(targetX, targetY, targetZ);
	        var position = _v3A.set(positionX, positionY, positionZ);
	        this._targetEnd.copy(target);
	        this._sphericalEnd.setFromVector3(position.sub(target).applyQuaternion(this._yAxisUpSpace));
	        this.normalizeRotations();
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._target.copy(this._targetEnd);
	            this._spherical.copy(this._sphericalEnd);
	        }
	        var resolveImmediately = !enableTransition ||
	            approxEquals(this._target.x, this._targetEnd.x, this.restThreshold) &&
	                approxEquals(this._target.y, this._targetEnd.y, this.restThreshold) &&
	                approxEquals(this._target.z, this._targetEnd.z, this.restThreshold) &&
	                approxEquals(this._spherical.theta, this._sphericalEnd.theta, this.restThreshold) &&
	                approxEquals(this._spherical.phi, this._sphericalEnd.phi, this.restThreshold) &&
	                approxEquals(this._spherical.radius, this._sphericalEnd.radius, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.lerpLookAt = function (positionAX, positionAY, positionAZ, targetAX, targetAY, targetAZ, positionBX, positionBY, positionBZ, targetBX, targetBY, targetBZ, t, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var targetA = _v3A.set(targetAX, targetAY, targetAZ);
	        var positionA = _v3B.set(positionAX, positionAY, positionAZ);
	        _sphericalA.setFromVector3(positionA.sub(targetA).applyQuaternion(this._yAxisUpSpace));
	        var targetB = _v3C.set(targetBX, targetBY, targetBZ);
	        var positionB = _v3B.set(positionBX, positionBY, positionBZ);
	        _sphericalB.setFromVector3(positionB.sub(targetB).applyQuaternion(this._yAxisUpSpace));
	        this._targetEnd.copy(targetA.lerp(targetB, t));
	        var deltaTheta = _sphericalB.theta - _sphericalA.theta;
	        var deltaPhi = _sphericalB.phi - _sphericalA.phi;
	        var deltaRadius = _sphericalB.radius - _sphericalA.radius;
	        this._sphericalEnd.set(_sphericalA.radius + deltaRadius * t, _sphericalA.phi + deltaPhi * t, _sphericalA.theta + deltaTheta * t);
	        this.normalizeRotations();
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._target.copy(this._targetEnd);
	            this._spherical.copy(this._sphericalEnd);
	        }
	        var resolveImmediately = !enableTransition ||
	            approxEquals(this._target.x, this._targetEnd.x, this.restThreshold) &&
	                approxEquals(this._target.y, this._targetEnd.y, this.restThreshold) &&
	                approxEquals(this._target.z, this._targetEnd.z, this.restThreshold) &&
	                approxEquals(this._spherical.theta, this._sphericalEnd.theta, this.restThreshold) &&
	                approxEquals(this._spherical.phi, this._sphericalEnd.phi, this.restThreshold) &&
	                approxEquals(this._spherical.radius, this._sphericalEnd.radius, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.setPosition = function (positionX, positionY, positionZ, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        return this.setLookAt(positionX, positionY, positionZ, this._targetEnd.x, this._targetEnd.y, this._targetEnd.z, enableTransition);
	    };
	    CameraControls.prototype.setTarget = function (targetX, targetY, targetZ, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var pos = this.getPosition(_v3A);
	        return this.setLookAt(pos.x, pos.y, pos.z, targetX, targetY, targetZ, enableTransition);
	    };
	    CameraControls.prototype.setFocalOffset = function (x, y, z, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        this._focalOffsetEnd.set(x, y, z);
	        this._needsUpdate = true;
	        if (!enableTransition) {
	            this._focalOffset.copy(this._focalOffsetEnd);
	        }
	        var resolveImmediately = !enableTransition ||
	            approxEquals(this._focalOffset.x, this._focalOffsetEnd.x, this.restThreshold) &&
	                approxEquals(this._focalOffset.y, this._focalOffsetEnd.y, this.restThreshold) &&
	                approxEquals(this._focalOffset.z, this._focalOffsetEnd.z, this.restThreshold);
	        return this._createOnRestPromise(resolveImmediately);
	    };
	    CameraControls.prototype.setOrbitPoint = function (targetX, targetY, targetZ) {
	        _xColumn.setFromMatrixColumn(this._camera.matrixWorldInverse, 0);
	        _yColumn.setFromMatrixColumn(this._camera.matrixWorldInverse, 1);
	        _zColumn.setFromMatrixColumn(this._camera.matrixWorldInverse, 2);
	        var position = _v3A.set(targetX, targetY, targetZ);
	        var distance = position.distanceTo(this._camera.position);
	        var cameraToPoint = position.sub(this._camera.position);
	        _xColumn.multiplyScalar(cameraToPoint.x);
	        _yColumn.multiplyScalar(cameraToPoint.y);
	        _zColumn.multiplyScalar(cameraToPoint.z);
	        _v3A.copy(_xColumn).add(_yColumn).add(_zColumn);
	        _v3A.z = _v3A.z + distance;
	        this.dollyTo(distance, false);
	        this.setFocalOffset(-_v3A.x, _v3A.y, -_v3A.z, false);
	        this.moveTo(targetX, targetY, targetZ, false);
	    };
	    CameraControls.prototype.setBoundary = function (box3) {
	        if (!box3) {
	            this._boundary.min.set(-Infinity, -Infinity, -Infinity);
	            this._boundary.max.set(Infinity, Infinity, Infinity);
	            this._needsUpdate = true;
	            return;
	        }
	        this._boundary.copy(box3);
	        this._boundary.clampPoint(this._targetEnd, this._targetEnd);
	        this._needsUpdate = true;
	    };
	    CameraControls.prototype.setViewport = function (viewportOrX, y, width, height) {
	        if (viewportOrX === null) {
	            this._viewport = null;
	            return;
	        }
	        this._viewport = this._viewport || new THREE.Vector4();
	        if (typeof viewportOrX === 'number') {
	            this._viewport.set(viewportOrX, y, width, height);
	        }
	        else {
	            this._viewport.copy(viewportOrX);
	        }
	    };
	    CameraControls.prototype.getDistanceToFitBox = function (width, height, depth) {
	        if (notSupportedInOrthographicCamera(this._camera, 'getDistanceToFitBox'))
	            return this._spherical.radius;
	        var boundingRectAspect = width / height;
	        var fov = this._camera.getEffectiveFOV() * THREE.MathUtils.DEG2RAD;
	        var aspect = this._camera.aspect;
	        var heightToFit = boundingRectAspect < aspect ? height : width / aspect;
	        return heightToFit * 0.5 / Math.tan(fov * 0.5) + depth * 0.5;
	    };
	    CameraControls.prototype.getDistanceToFit = function (width, height, depth) {
	        console.warn('camera-controls: getDistanceToFit() has been renamed to getDistanceToFitBox()');
	        return this.getDistanceToFitBox(width, height, depth);
	    };
	    CameraControls.prototype.getDistanceToFitSphere = function (radius) {
	        if (notSupportedInOrthographicCamera(this._camera, 'getDistanceToFitSphere'))
	            return this._spherical.radius;
	        var vFOV = this._camera.getEffectiveFOV() * THREE.MathUtils.DEG2RAD;
	        var hFOV = Math.atan(Math.tan(vFOV * 0.5) * this._camera.aspect) * 2;
	        var fov = 1 < this._camera.aspect ? vFOV : hFOV;
	        return radius / (Math.sin(fov * 0.5));
	    };
	    CameraControls.prototype.getTarget = function (out) {
	        var _out = !!out && out.isVector3 ? out : new THREE.Vector3();
	        return _out.copy(this._targetEnd);
	    };
	    CameraControls.prototype.getPosition = function (out) {
	        var _out = !!out && out.isVector3 ? out : new THREE.Vector3();
	        return _out.setFromSpherical(this._sphericalEnd).applyQuaternion(this._yAxisUpSpaceInverse).add(this._targetEnd);
	    };
	    CameraControls.prototype.getFocalOffset = function (out) {
	        var _out = !!out && out.isVector3 ? out : new THREE.Vector3();
	        return _out.copy(this._focalOffsetEnd);
	    };
	    CameraControls.prototype.normalizeRotations = function () {
	        this._sphericalEnd.theta = this._sphericalEnd.theta % PI_2;
	        if (this._sphericalEnd.theta < 0)
	            this._sphericalEnd.theta += PI_2;
	        this._spherical.theta += PI_2 * Math.round((this._sphericalEnd.theta - this._spherical.theta) / PI_2);
	    };
	    CameraControls.prototype.reset = function (enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var promises = [
	            this.setLookAt(this._position0.x, this._position0.y, this._position0.z, this._target0.x, this._target0.y, this._target0.z, enableTransition),
	            this.setFocalOffset(this._focalOffset0.x, this._focalOffset0.y, this._focalOffset0.z, enableTransition),
	            this.zoomTo(this._zoom0, enableTransition),
	        ];
	        return Promise.all(promises);
	    };
	    CameraControls.prototype.saveState = function () {
	        this._target0.copy(this._target);
	        this._position0.copy(this._camera.position);
	        this._zoom0 = this._zoom;
	    };
	    CameraControls.prototype.updateCameraUp = function () {
	        this._yAxisUpSpace.setFromUnitVectors(this._camera.up, _AXIS_Y);
	        quatInvertCompat(this._yAxisUpSpaceInverse.copy(this._yAxisUpSpace));
	    };
	    CameraControls.prototype.update = function (delta) {
	        var dampingFactor = this._state === ACTION.NONE ? this.dampingFactor : this.draggingDampingFactor;
	        var lerpRatio = Math.min(dampingFactor * delta * 60, 1);
	        var deltaTheta = this._sphericalEnd.theta - this._spherical.theta;
	        var deltaPhi = this._sphericalEnd.phi - this._spherical.phi;
	        var deltaRadius = this._sphericalEnd.radius - this._spherical.radius;
	        var deltaTarget = _v3A.subVectors(this._targetEnd, this._target);
	        var deltaOffset = _v3B.subVectors(this._focalOffsetEnd, this._focalOffset);
	        if (!approxZero(deltaTheta) ||
	            !approxZero(deltaPhi) ||
	            !approxZero(deltaRadius) ||
	            !approxZero(deltaTarget.x) ||
	            !approxZero(deltaTarget.y) ||
	            !approxZero(deltaTarget.z) ||
	            !approxZero(deltaOffset.x) ||
	            !approxZero(deltaOffset.y) ||
	            !approxZero(deltaOffset.z)) {
	            this._spherical.set(this._spherical.radius + deltaRadius * lerpRatio, this._spherical.phi + deltaPhi * lerpRatio, this._spherical.theta + deltaTheta * lerpRatio);
	            this._target.add(deltaTarget.multiplyScalar(lerpRatio));
	            this._focalOffset.add(deltaOffset.multiplyScalar(lerpRatio));
	            this._needsUpdate = true;
	        }
	        else {
	            this._spherical.copy(this._sphericalEnd);
	            this._target.copy(this._targetEnd);
	            this._focalOffset.copy(this._focalOffsetEnd);
	        }
	        if (this._dollyControlAmount !== 0) {
	            if (isPerspectiveCamera(this._camera)) {
	                var camera = this._camera;
	                var direction = _v3A.setFromSpherical(this._sphericalEnd).applyQuaternion(this._yAxisUpSpaceInverse).normalize().negate();
	                var planeX = _v3B.copy(direction).cross(camera.up).normalize();
	                if (planeX.lengthSq() === 0)
	                    planeX.x = 1.0;
	                var planeY = _v3C.crossVectors(planeX, direction);
	                var worldToScreen = this._sphericalEnd.radius * Math.tan(camera.getEffectiveFOV() * THREE.MathUtils.DEG2RAD * 0.5);
	                var prevRadius = this._sphericalEnd.radius - this._dollyControlAmount;
	                var lerpRatio_1 = (prevRadius - this._sphericalEnd.radius) / this._sphericalEnd.radius;
	                var cursor = _v3A.copy(this._targetEnd)
	                    .add(planeX.multiplyScalar(this._dollyControlCoord.x * worldToScreen * camera.aspect))
	                    .add(planeY.multiplyScalar(this._dollyControlCoord.y * worldToScreen));
	                this._targetEnd.lerp(cursor, lerpRatio_1);
	                this._target.copy(this._targetEnd);
	            }
	            else if (isOrthographicCamera(this._camera)) {
	                var camera = this._camera;
	                var worldPosition = _v3A.set(this._dollyControlCoord.x, this._dollyControlCoord.y, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
	                var quaternion = _v3B.set(0, 0, -1).applyQuaternion(camera.quaternion);
	                var divisor = quaternion.dot(camera.up);
	                var distance = approxZero(divisor) ? -worldPosition.dot(camera.up) : -worldPosition.dot(camera.up) / divisor;
	                var cursor = _v3C.copy(worldPosition).add(quaternion.multiplyScalar(distance));
	                this._targetEnd.lerp(cursor, 1 - camera.zoom / this._dollyControlAmount);
	                this._target.copy(this._targetEnd);
	            }
	            this._dollyControlAmount = 0;
	        }
	        var maxDistance = this._collisionTest();
	        this._spherical.radius = Math.min(this._spherical.radius, maxDistance);
	        this._spherical.makeSafe();
	        this._camera.position.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(this._target);
	        this._camera.lookAt(this._target);
	        var affectOffset = !approxZero(this._focalOffset.x) ||
	            !approxZero(this._focalOffset.y) ||
	            !approxZero(this._focalOffset.z);
	        if (affectOffset) {
	            this._camera.updateMatrix();
	            _xColumn.setFromMatrixColumn(this._camera.matrix, 0);
	            _yColumn.setFromMatrixColumn(this._camera.matrix, 1);
	            _zColumn.setFromMatrixColumn(this._camera.matrix, 2);
	            _xColumn.multiplyScalar(this._focalOffset.x);
	            _yColumn.multiplyScalar(-this._focalOffset.y);
	            _zColumn.multiplyScalar(this._focalOffset.z);
	            _v3A.copy(_xColumn).add(_yColumn).add(_zColumn);
	            this._camera.position.add(_v3A);
	        }
	        if (this._boundaryEnclosesCamera) {
	            this._encloseToBoundary(this._camera.position.copy(this._target), _v3A.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse), 1.0);
	        }
	        var zoomDelta = this._zoomEnd - this._zoom;
	        this._zoom += zoomDelta * lerpRatio;
	        if (this._camera.zoom !== this._zoom) {
	            if (approxZero(zoomDelta))
	                this._zoom = this._zoomEnd;
	            this._camera.zoom = this._zoom;
	            this._camera.updateProjectionMatrix();
	            this._updateNearPlaneCorners();
	            this._needsUpdate = true;
	        }
	        var updated = this._needsUpdate;
	        if (updated && !this._updatedLastTime) {
	            this._hasRested = false;
	            this.dispatchEvent({ type: 'wake' });
	            this.dispatchEvent({ type: 'update' });
	        }
	        else if (updated) {
	            this.dispatchEvent({ type: 'update' });
	            if (approxZero(deltaTheta, this.restThreshold) &&
	                approxZero(deltaPhi, this.restThreshold) &&
	                approxZero(deltaRadius, this.restThreshold) &&
	                approxZero(deltaTarget.x, this.restThreshold) &&
	                approxZero(deltaTarget.y, this.restThreshold) &&
	                approxZero(deltaTarget.z, this.restThreshold) &&
	                approxZero(deltaOffset.x, this.restThreshold) &&
	                approxZero(deltaOffset.y, this.restThreshold) &&
	                approxZero(deltaOffset.z, this.restThreshold) &&
	                !this._hasRested) {
	                this._hasRested = true;
	                this.dispatchEvent({ type: 'rest' });
	            }
	        }
	        else if (!updated && this._updatedLastTime) {
	            this.dispatchEvent({ type: 'sleep' });
	        }
	        this._updatedLastTime = updated;
	        this._needsUpdate = false;
	        return updated;
	    };
	    CameraControls.prototype.toJSON = function () {
	        return JSON.stringify({
	            enabled: this._enabled,
	            minDistance: this.minDistance,
	            maxDistance: infinityToMaxNumber(this.maxDistance),
	            minZoom: this.minZoom,
	            maxZoom: infinityToMaxNumber(this.maxZoom),
	            minPolarAngle: this.minPolarAngle,
	            maxPolarAngle: infinityToMaxNumber(this.maxPolarAngle),
	            minAzimuthAngle: infinityToMaxNumber(this.minAzimuthAngle),
	            maxAzimuthAngle: infinityToMaxNumber(this.maxAzimuthAngle),
	            dampingFactor: this.dampingFactor,
	            draggingDampingFactor: this.draggingDampingFactor,
	            dollySpeed: this.dollySpeed,
	            truckSpeed: this.truckSpeed,
	            dollyToCursor: this.dollyToCursor,
	            verticalDragToForward: this.verticalDragToForward,
	            target: this._targetEnd.toArray(),
	            position: _v3A.setFromSpherical(this._sphericalEnd).add(this._targetEnd).toArray(),
	            zoom: this._zoomEnd,
	            focalOffset: this._focalOffsetEnd.toArray(),
	            target0: this._target0.toArray(),
	            position0: this._position0.toArray(),
	            zoom0: this._zoom0,
	            focalOffset0: this._focalOffset0.toArray(),
	        });
	    };
	    CameraControls.prototype.fromJSON = function (json, enableTransition) {
	        if (enableTransition === void 0) { enableTransition = false; }
	        var obj = JSON.parse(json);
	        var position = _v3A.fromArray(obj.position);
	        this.enabled = obj.enabled;
	        this.minDistance = obj.minDistance;
	        this.maxDistance = maxNumberToInfinity(obj.maxDistance);
	        this.minZoom = obj.minZoom;
	        this.maxZoom = maxNumberToInfinity(obj.maxZoom);
	        this.minPolarAngle = obj.minPolarAngle;
	        this.maxPolarAngle = maxNumberToInfinity(obj.maxPolarAngle);
	        this.minAzimuthAngle = maxNumberToInfinity(obj.minAzimuthAngle);
	        this.maxAzimuthAngle = maxNumberToInfinity(obj.maxAzimuthAngle);
	        this.dampingFactor = obj.dampingFactor;
	        this.draggingDampingFactor = obj.draggingDampingFactor;
	        this.dollySpeed = obj.dollySpeed;
	        this.truckSpeed = obj.truckSpeed;
	        this.dollyToCursor = obj.dollyToCursor;
	        this.verticalDragToForward = obj.verticalDragToForward;
	        this._target0.fromArray(obj.target0);
	        this._position0.fromArray(obj.position0);
	        this._zoom0 = obj.zoom0;
	        this._focalOffset0.fromArray(obj.focalOffset0);
	        this.moveTo(obj.target[0], obj.target[1], obj.target[2], enableTransition);
	        _sphericalA.setFromVector3(position.sub(this._targetEnd).applyQuaternion(this._yAxisUpSpace));
	        this.rotateTo(_sphericalA.theta, _sphericalA.phi, enableTransition);
	        this.zoomTo(obj.zoom, enableTransition);
	        this.setFocalOffset(obj.focalOffset[0], obj.focalOffset[1], obj.focalOffset[2], enableTransition);
	        this._needsUpdate = true;
	    };
	    CameraControls.prototype.dispose = function () {
	        this._removeAllEventListeners();
	    };
	    CameraControls.prototype._findPointerById = function (pointerId) {
	        var pointer = null;
	        this._activePointers.some(function (activePointer) {
	            if (activePointer.pointerId === pointerId) {
	                pointer = activePointer;
	                return true;
	            }
	            return false;
	        });
	        return pointer;
	    };
	    CameraControls.prototype._encloseToBoundary = function (position, offset, friction) {
	        var offsetLength2 = offset.lengthSq();
	        if (offsetLength2 === 0.0) {
	            return position;
	        }
	        var newTarget = _v3B.copy(offset).add(position);
	        var clampedTarget = this._boundary.clampPoint(newTarget, _v3C);
	        var deltaClampedTarget = clampedTarget.sub(newTarget);
	        var deltaClampedTargetLength2 = deltaClampedTarget.lengthSq();
	        if (deltaClampedTargetLength2 === 0.0) {
	            return position.add(offset);
	        }
	        else if (deltaClampedTargetLength2 === offsetLength2) {
	            return position;
	        }
	        else if (friction === 0.0) {
	            return position.add(offset).add(deltaClampedTarget);
	        }
	        else {
	            var offsetFactor = 1.0 + friction * deltaClampedTargetLength2 / offset.dot(deltaClampedTarget);
	            return position
	                .add(_v3B.copy(offset).multiplyScalar(offsetFactor))
	                .add(deltaClampedTarget.multiplyScalar(1.0 - friction));
	        }
	    };
	    CameraControls.prototype._updateNearPlaneCorners = function () {
	        if (isPerspectiveCamera(this._camera)) {
	            var camera = this._camera;
	            var near = camera.near;
	            var fov = camera.getEffectiveFOV() * THREE.MathUtils.DEG2RAD;
	            var heightHalf = Math.tan(fov * 0.5) * near;
	            var widthHalf = heightHalf * camera.aspect;
	            this._nearPlaneCorners[0].set(-widthHalf, -heightHalf, 0);
	            this._nearPlaneCorners[1].set(widthHalf, -heightHalf, 0);
	            this._nearPlaneCorners[2].set(widthHalf, heightHalf, 0);
	            this._nearPlaneCorners[3].set(-widthHalf, heightHalf, 0);
	        }
	        else if (isOrthographicCamera(this._camera)) {
	            var camera = this._camera;
	            var zoomInv = 1 / camera.zoom;
	            var left = camera.left * zoomInv;
	            var right = camera.right * zoomInv;
	            var top_1 = camera.top * zoomInv;
	            var bottom = camera.bottom * zoomInv;
	            this._nearPlaneCorners[0].set(left, top_1, 0);
	            this._nearPlaneCorners[1].set(right, top_1, 0);
	            this._nearPlaneCorners[2].set(right, bottom, 0);
	            this._nearPlaneCorners[3].set(left, bottom, 0);
	        }
	    };
	    CameraControls.prototype._collisionTest = function () {
	        var distance = Infinity;
	        var hasCollider = this.colliderMeshes.length >= 1;
	        if (!hasCollider)
	            return distance;
	        if (notSupportedInOrthographicCamera(this._camera, '_collisionTest'))
	            return distance;
	        var direction = _v3A.setFromSpherical(this._spherical).divideScalar(this._spherical.radius);
	        _rotationMatrix.lookAt(_ORIGIN, direction, this._camera.up);
	        for (var i = 0; i < 4; i++) {
	            var nearPlaneCorner = _v3B.copy(this._nearPlaneCorners[i]);
	            nearPlaneCorner.applyMatrix4(_rotationMatrix);
	            var origin_1 = _v3C.addVectors(this._target, nearPlaneCorner);
	            _raycaster.set(origin_1, direction);
	            _raycaster.far = this._spherical.radius + 1;
	            var intersects = _raycaster.intersectObjects(this.colliderMeshes);
	            if (intersects.length !== 0 && intersects[0].distance < distance) {
	                distance = intersects[0].distance;
	            }
	        }
	        return distance;
	    };
	    CameraControls.prototype._getClientRect = function (target) {
	        var rect = this._domElement.getBoundingClientRect();
	        target.x = rect.left;
	        target.y = rect.top;
	        if (this._viewport) {
	            target.x += this._viewport.x;
	            target.y += rect.height - this._viewport.w - this._viewport.y;
	            target.width = this._viewport.z;
	            target.height = this._viewport.w;
	        }
	        else {
	            target.width = rect.width;
	            target.height = rect.height;
	        }
	        return target;
	    };
	    CameraControls.prototype._createOnRestPromise = function (resolveImmediately) {
	        var _this = this;
	        if (resolveImmediately)
	            return Promise.resolve();
	        this._hasRested = false;
	        this.dispatchEvent({ type: 'transitionstart' });
	        return new Promise(function (resolve) {
	            var onResolve = function () {
	                _this.removeEventListener('rest', onResolve);
	                resolve();
	            };
	            _this.addEventListener('rest', onResolve);
	        });
	    };
	    CameraControls.prototype._removeAllEventListeners = function () { };
	    return CameraControls;
	}(EventDispatcher));
	function createBoundingSphere(object3d, out) {
	    var boundingSphere = out;
	    var center = boundingSphere.center;
	    object3d.traverse(function (object) {
	        if (!object.isMesh)
	            return;
	        _box3A.expandByObject(object);
	    });
	    _box3A.getCenter(center);
	    var maxRadiusSq = 0;
	    object3d.traverse(function (object) {
	        if (!object.isMesh)
	            return;
	        var mesh = object;
	        var geometry = mesh.geometry.clone();
	        geometry.applyMatrix4(mesh.matrixWorld);
	        if (geometry.isBufferGeometry) {
	            var bufferGeometry = geometry;
	            var position = bufferGeometry.attributes.position;
	            for (var i = 0, l = position.count; i < l; i++) {
	                _v3A.fromBufferAttribute(position, i);
	                maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_v3A));
	            }
	        }
	        else {
	            var position = geometry.attributes.position;
	            var vector = new THREE.Vector3();
	            for (var i = 0, l = position.count; i < l; i++) {
	                vector.fromBufferAttribute(position, i);
	                maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));
	            }
	        }
	    });
	    boundingSphere.radius = Math.sqrt(maxRadiusSq);
	    return boundingSphere;
	}

	return CameraControls;

}));
