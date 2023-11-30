const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager.SignalManager;
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils();

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const Signals = imports.signals;

class AudioController {
	constructor(){
        this._signalManager = new SignalManager(null);
        this.volumeMax = 0;
        this.volumeNorm = 0;
		this._setupMixerControls();
    }

	_setupMixerControls() {
		this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
		this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });

		this._control.open();

		this.volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		this.volumeNorm = this._control.get_vol_max_norm();

		this._signalManager.connect(this._control, 'state-changed', this._onMixerControlStateChanged, this, true);
		this._signalManager.connect(this._control, 'default-sink-changed', this._onDefaultChanged.bind(this, 'sink'));
		this._signalManager.connect(this._control, 'default-source-changed', this._onDefaultChanged.bind(this, 'source'));

    }

	_onMixerControlStateChanged(){
		this.emit('control-state-changed', (this._control.get_state() == Cvc.MixerControlState.READY));
	}

	toggle_mute(direction) {
		global.log(`_toggle_mute:: ${direction}`)
		let stream = this._control[`get_default_${direction}`](); 
		stream.change_is_muted(!stream.is_muted);
	}

	toggle_setup(type) {
		LOG.init();
		let device = this._detect_devices(type);
		global.log(device);
		if (!device) {
			LOG.error(`${type} not found!!!`)
			// send notification
			return;
		}
		this._control.change_input(device.source);
		this._control.change_output(device.sink);
	}

	_detect_devices(type) {
		let devices = this._control.get_streams()
			.filter( stream => stream.get_card_index() != 4294967295 )
			.filter( stream => this._control.lookup_device_from_stream(stream)["port-available"] )
			.reduce((map, stream)=> {
				let device = this._control.lookup_device_from_stream(stream);
				let direction =  device.is_output() ? "sink" : "source";
				let type = device.description == "Headset" ? "Headset" : "Speakers"; 
				(map[type][device.origin] = map[type][device.origin] ?? {})[direction] = device;
				return map;
			}, {"Headset": {}, "Speakers": {}});

		if (type == "Headset") {
			return devices.Headset [
				['Plantronics', 'SteelSeries'].find(name => devices.Headset[name])
			];
	
		} else {
			let speaker = devices.Speakers.Interno;
			speaker.source = devices.Speakers.VD5?.source ?? speaker.source; 
			return speaker;
		}
	}	

	_onDefaultChanged(direction, control, id) {
		global.log(`_onDefaultChanged:: id=${id}, type=${direction}`);
		let stream = control.lookup_stream_id(id);
		if (!stream) return;
		let device = control.lookup_device_from_stream(stream);
		this._rebindMute();
		let type = device.description == "Headset" ? "Headset" : "Speakers"; 
		this.emit('default-changed', type, direction, stream);
		this.emit('change-mute', direction, stream.is_muted);
	}

	_rebindMute() {
		this._signalManager.disconnect('notify::is-muted');
		this._signalManager.connect(this._control.get_default_sink(), 'notify::is-muted', () => this.emit('change-mute', 'sink', this._control.get_default_sink().is_muted));
		this._signalManager.connect(this._control.get_default_source(), 'notify::is-muted', () => this.emit('change-mute', 'source', this._control.get_default_source().is_muted));
	}

    destroy() {
		Main.keybindingManager.removeHotKey("use-headset-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-speakers-" + this.instance_id);
		this._signalManager.disconnectAllSignals();
    }

}
Signals.addSignalMethods(AudioController.prototype);