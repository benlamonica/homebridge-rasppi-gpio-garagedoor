var fs = require('fs');
var Service, Characteristic, DoorState; // set in the module.exports, from homebridge
var process = require('process');

if (process.geteuid() != 0) {
    throw new Error('must run homebridge as root to control gpio pins');
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  DoorState = homebridge.hap.Characteristic.CurrentDoorState;

  homebridge.registerAccessory("homebridge-rasppi-gpio-garagedoor", "RaspPiGPIOGarageDoor", RaspPiGPIOGarageDoorAccessory);
}

function getVal(config, key, defaultVal) {
    var val = config[key];
    if (val == null) {
        return defaultVal;
    }
    return val;
}

function RaspPiGPIOGarageDoorAccessory(log, config) {
  this.log = log;
  var version = require('./package.json').version;
  log("RaspPiGPIOGarageDoorAccessory version " + version);
  this.name = config["name"];
  this.doorSwitchPin = config["doorSwitchPin"];
  this.doorSwitchPressTimeInMs = getVal(config, "doorSwitchPressTimeInMs", 1000);
  this.doorClosedSensorPin = config["doorClosedSensorPin"];
  this.doorOpenSensorPin = config["doorOpenSensorPin"];
  this.sensorPollInMs = getVal(config, "doorPollInMs", 4000);
  this.doorOpensInSeconds = config["doorOpensInSeconds"];
  this.closedDoorSensorValue = getVal(config, "closedDoorSensorValue", 1);
  this.openDoorSensorValue = getVal(config, "openDoorSensorValue", 1);
  this.relayOn = getVal(config, "relayOnValue", 1);
  this.relayOff = 1-this.relayOn; //opposite of relayOn (O/1)
  log("Door Switch Pin: " + this.doorSwitchPin);
  log("Door Closed Sensor Pin: " + this.doorClosedSensorPin);
  log("Door Open Sensor Pin: " + this.doorOpenSensorPin);
  log("Sensor Poll in ms: " + this.sensorPollInMs);
  log("Door Opens in seconds: " + this.doorOpensInSeconds);
  this.initService();
}

RaspPiGPIOGarageDoorAccessory.prototype = {

  monitorDoorState: function() {
     var isClosed = this.isClosed();
     //this.log("isClosed = " + isClosed + ", wasClosed = " + this.wasClosed);
     var isOpen = this.isOpen();
     //this.log("isOpen = " + isOpen);
     if (isClosed != this.wasClosed) {
       this.wasClosed = isClosed;
       var state = isClosed ? DoorState.CLOSED : DoorState.OPEN;       
       this.log("Door state changed to " + (isClosed ? "CLOSED" : "OPEN"));
       if (!this.operating) {
         this.log("setting state to " + state);
         this.currentDoorState.setValue(state);
         this.targetDoorState.setValue(state);
         this.targetState = state;
       }
     }
     setTimeout(this.monitorDoorState.bind(this), this.sensorPollInMs);
  },

  hasOpenSensor : function() {
    return this.doorOpenSensorPin != null;
  },

  hasClosedSensor : function() {
    return this.doorClosedSensorPin != null;
  },

  initService: function() {
    this.garageDoorOpener = new Service.GarageDoorOpener(this.name,this.name);
    this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
    this.currentDoorState.on('get', this.getState.bind(this));
    this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    this.targetDoorState.on('set', this.setState.bind(this));
    this.targetDoorState.on('get', this.getTargetState.bind(this));
    var isClosed = this.isClosed();
    this.currentDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, "RaspPi GPIO GarageDoor")
      .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.0");
  
    this.wasClosed = isClosed;
    this.operating = false;
    if (this.hasOpenSensor() || this.hasClosedSensor()) {
        this.log("monitoring door state.");
        setTimeout(this.monitorDoorState.bind(this), this.sensorPollInMs);
    }
  },

  getTargetState: function(callback) {
    callback(null, this.targetState);
  },

  readPin: function(pin) {
      return parseInt(fs.readFileSync("/sys/class/gpio/gpio"+pin+"/value", "utf8").trim());
  },

  writePin: function(pin,val) {
      fs.writeFileSync("/sys/class/gpio/gpio"+pin+"/value", val.toString());
  },

  isClosed: function() {
    if (this.hasClosedSensor()) {
        this.log("Checking pin value");
        return this.readPin(this.doorClosedSensorPin) == this.closedDoorSensorValue;
    } else {
	this.log("just getting state.");
        return this.currentDoorState.getValue() == DoorState.CLOSED;
    }
  },

  isOpen: function() {
    if (this.hasOpenSensor()) {
        return this.readPin(this.doorOpenSensorPin) == this.openDoorSensorValue;
    } else {
        return !this.isClosed();
    }
  },

  switchOn: function() {
    this.writePin(this.doorSwitchPin, this.relayOn);
    setTimeout(this.switchOff.bind(this), this.doorSwitchPressTimeInMs);
    this.log("Turning on GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOn);
  },

  switchOff: function() {
    this.writePin(this.doorSwitchPin, this.relayOff);
    this.log("Turning off GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOff);
  },

  setFinalDoorState: function() {
    var isClosed = this.isClosed();
    var isOpen = this.isOpen();
    if ((hasClosedSensor() && this.targetState == DoorState.CLOSED && !isClosed) || (hasOpenSensor() && this.targetState == DoorState.OPEN && !isOpen)) {
      this.log("Was trying to " + (this.targetState == DoorState.CLOSED ? " CLOSE " : " OPEN ") + "the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
      this.currentDoorState.setValue(DoorState.STOPPED);
      this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    } else {
      this.log("Set current state to " + this.targetState == DoorState.CLOSED ? "CLOSED" : "OPEN");
      this.currentDoorState.setValue(this.targetState);
      this.targetDoorState.setValue(this.targetState);
    }
    this.operating = false;
  },

  setState: function(state, callback) {
    this.log("Setting state to " + state);
    this.targetState = state;
    var isClosed = this.isClosed();
    if ((state == DoorState.OPEN && isClosed) || (state == DoorState.CLOSED && !isClosed)) {
        this.log("Triggering GarageDoor Relay");
        this.operating = true; 
        if (state == DoorState.OPEN) {
            this.currentDoorState.setValue(DoorState.OPENING);
            if (!this.hasOpenSensor) {
                setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
            }
        } else {
            this.currentDoorState.setValue(DoorState.CLOSING);
            if (!this.hasClosedSensor) {
                setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
            }
        }
	this.switchOn();
    }

    callback();
    return true;
  },

  getState: function(callback) {
    var isClosed = this.isClosed();
    this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : "OPEN ("+DoorState.OPEN+")")); 
    callback(null, (isClosed ? DoorState.CLOSED : DoorState.OPEN));
  },

  getServices: function() {
    return [this.infoService, this.garageDoorOpener];
  }
};
