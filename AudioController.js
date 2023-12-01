const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager.SignalManager;
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils();

const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const Signals = imports.signals;
var VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */


class AudioController {
	constructor(){
        this._signalManager = new SignalManager(null);
		this._setupMixerControls();
    }

	change_volume(slider, percentage) {
		let volume;
		let volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		let volumeNorm = this._control.get_vol_max_norm();

		if(percentage < 0.005) 
			volume = 0
		else if (volume != volumeNorm && volume > volumeNorm*(1-VOLUME_ADJUSTMENT_STEP/2) && volume < volumeNorm*(1+VOLUME_ADJUSTMENT_STEP/2))
			volume = volumeNorm;
		else 
			volume = percentage * volumeMax;

		let stream = this._control[`get_default_${slider.direction}`](); 
		stream.volume = volume;
		if(stream.is_muted !== (volume == 0)) {
			this.toggle_mute(slider.direction);
		}
		stream.push_volume();
	}

	_setupMixerControls() {
		this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
		this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });

		this._control.open();

		this._signalManager.connect(this._sound_settings, `changed::${MAXIMUM_VOLUME_KEY}`, this._onSettingsChanged, this);
		this._signalManager.connect(this._control, 'state-changed', this._onMixerControlStateChanged, this, true);
		this._signalManager.connect(this._control, 'default-sink-changed', this._onDefaultChanged.bind(this, 'sink'));
		this._signalManager.connect(this._control, 'default-source-changed', this._onDefaultChanged.bind(this, 'source'));

    }

	_onSettingsChanged() {
		this._onChangeVolume(this._control.get_default_sink());
		this._onChangeVolume(this._control.get_default_source());
	}

	_onMixerControlStateChanged(){
		if (this._control.get_state() == Cvc.MixerControlState.READY) {
			this.emit(
				'control-state-changed', 
				true
			);
			this._onSettingsChanged();
		} else {
			this.emit('control-state-changed', false);
		}
	}

	toggle_mute(direction) {
		let stream = this._control[`get_default_${direction}`](); 
		stream.change_is_muted(!stream.is_muted);
	}

	toggle_setup(type) {
		let device = this._detect_devices(type);
		global.log(device);
		if (!device) {
			LOG.error(`${type} not found!!!`)
			// send notification
			return;
		}
		if (device.source) this._control.change_input(device.source);
		if (device.sink) this._control.change_output(device.sink);
	}

	_detect_devices(type) {
		let devices = this._control.get_streams()
			.filter( stream => stream.get_card_index() != 4294967295 )
			.filter( stream => this._control.lookup_device_from_stream(stream).port_available )
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
		let stream = control.lookup_stream_id(id);
		if (!stream) return;
		let device = control.lookup_device_from_stream(stream);
		this._rebindSignals();
		let type = device.description == "Headset" ? "Headset" : "Speakers"; 
		this.emit('default-changed', type);
		this.emit('change-mute', direction, stream.is_muted);
	}

	_rebindSignals() {
		this._signalManager.disconnect('notify::is-muted');
		this._signalManager.connect(this._control.get_default_sink(), 'notify::is-muted', () => this.emit('change-mute', 'sink', this._control.get_default_sink().is_muted));
		this._signalManager.connect(this._control.get_default_source(), 'notify::is-muted', () => this.emit('change-mute', 'source', this._control.get_default_source().is_muted));

		this._signalManager.disconnect("notify::volume");
		this._signalManager.connect(this._control.get_default_sink(), 'notify::volume', this._onChangeVolume, this, true);
		this._signalManager.connect(this._control.get_default_source(), 'notify::volume', this._onChangeVolume, this, true);
	}

	_onChangeVolume(stream) {
		let info = this._getStreaminfo(stream);
		this.emit(`change-volume-${info.direction}`, info.percentage, info.mark);
		this._onChangeStatus();
	}

	_getStreaminfo(stream) {
		let volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		let volumeNorm = this._control.get_vol_max_norm();
		let percentage = stream.volume / volumeMax;
		let mark = volumeNorm / volumeMax;
		let direction = stream.constructor.name.replace("Cvc_Mixer", "").toLowerCase();
		return {direction: direction, percentage: percentage, mark: mark, muted: stream.is_muted}
	}

	_onChangeStatus() {
		this.emit(`status-update`, {
			source: this._getStreaminfo(this._control.get_default_source()),
			sink: this._getStreaminfo(this._control.get_default_sink())
		});
	}

    destroy() {
		Main.keybindingManager.removeHotKey("use-headset-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-speakers-" + this.instance_id);
		this._signalManager.disconnectAllSignals();
    }

}
Signals.addSignalMethods(AudioController.prototype);