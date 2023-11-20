const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Cvc = imports.gi.Cvc;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;
const {VolumeSlider} = require('./VolumeSlider');
const {MultiIconApplet} = require('./MultiIconApplet');
const {SignalManager} = imports.misc.signalManager;


const CINNAMON_DESKTOP_SOUNDS = "org.cinnamon.desktop.sound";
const MAXIMUM_VOLUME_KEY = "maximum-volume";
const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

class SimpleSoundApplet extends MultiIconApplet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId, ['_input', '_output']);
		this.metadata = metadata;
		this.set_applet_icon_symbolic_name('_input','audio-input-microphone-symbolic');
		this.set_applet_icon_symbolic_name('_output','audio-headset-symbolic');
		this.mute_switch = [];
		this.mute_id = [];
		this.stream = [];
		this.volume_selection = [];
		this.devices = {
			"_output": [],
			"_input": []
		};
        this.signals = new SignalManager(null);
		this.controls = {};
		this.setup = {};

		this.setupMixerControls();
		this.drawMenu(orientation);
		this.setupListeners();

		this._setKeybinding();
		this.setupConfiguration();
	}

	setupConfiguration () {
		this.settings = new Settings.AppletSettings(this.setup, this.metadata.uuid, this.instanceId);
		this.settings.bind("headset_input", "headset_input", this._onSettingsChanged.bind(this), "headset_input");
		this.settings.bind("headset_output", "headset_output", this._onSettingsChanged.bind(this), "headset_output");
		this.settings.bind("speakers_input", "speakers_input", this._onSettingsChanged.bind(this), "speakers_input");
		this.settings.bind("speakers_output", "speakers_output", this._onSettingsChanged.bind(this), "speakers_output");
	}

	drawMenu(orientation) {
		// controles
		this.mute_switch['_output'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-headset-symbolic", St.IconType.SYMBOLIC);
		this.mute_switch['_input'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
		this.volume_selection['_output'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Volume"), 'audio-headset-symbolic');
		this.volume_selection['_input'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Microphone"), 'audio-input-microphone-symbolic');

		// menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		// botoes de mute
		this.menu.addMenuItem(this.mute_switch['_input']);
		this.menu.addMenuItem(this.mute_switch['_output']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.menu.addMenuItem(this._drawDevice("Headset"));
		this.menu.addMenuItem(this._drawDevice("Speakers"));

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// deslizantes de volume
		this.menu.addMenuItem(this.volume_selection['_input']);
		this.menu.addMenuItem(this.volume_selection['_output']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// ajustes
		this.menu.addSettingsAction(_("Sound Settings"), 'sound');
		this.menu.addCommandlineAction(_("Pulse Audio Settings"), 'pavucontrol');

	}

	_drawDevice(setup){
		let device = new PopupMenu.PopupMenuItem(setup);
		let bin = new St.Bin({ x_align: St.Align.END, style_class: 'popup-active-menu-item' });
		device.addActor(bin, { expand: false, span: -1, align: St.Align.END });
		device.activate = () => this._toggle_setup(setup);
		this.controls[setup] = device;
		return device;
	}

	_toggle_setup(setup) {
		global.log(`_toggle_setup:: ${setup}`);
		this._control.change_input(this.getDevice(setup, "_input"));
		this._control.change_output(this.getDevice(setup, "_output"));
	}

	setupMixerControls() {
		Main.keybindingManager.addHotKey("sound-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this.on_applet_clicked));
		this._control = new Cvc.MixerControl({ name: 'Cinnamon Volume Control' });
		this._sound_settings = new Gio.Settings({ schema_id: CINNAMON_DESKTOP_SOUNDS });
		this._control.open();

		this._volumeMax = this._sound_settings.get_int(MAXIMUM_VOLUME_KEY) / 100 * this._control.get_vol_max_norm();
		this._volumeNorm = this._control.get_vol_max_norm();


		this._control.connect('output-added', (...args) => this._onDeviceAdded(...args, "_output"));
		this._control.connect('input-added', (...args) => this._onDeviceAdded(...args, "_input"));


		this._control.connect('output-removed', (...args) => this._onDeviceRemoved(...args, "_output"));
		this._control.connect('input-removed', (...args) => this._onDeviceRemoved(...args, "_input"));


		this._control.connect('state-changed', (...args) => this._onControlStateChanged(...args));
		this._control.connect('default-sink-changed', this._onDefaultChanged.bind(this, '_output'));
		this._control.connect('default-source-changed', this._onDefaultChanged.bind(this, '_input'));
	}

	setupListeners() {
		this.mute_switch['_output'].connect('toggled', () => this._toggle_mute('_output'));
		this.mute_switch['_input'].connect('toggled', () => this._toggle_mute('_input'));
		this.volume_selection['_output'].connect("volume-changed", (...args) => this._updateTooltip(...args));
		this.volume_selection['_input'].connect("toggle-mute", () => this._toggle_mute('_input'));
		this.volume_selection['_output'].connect("toggle-mute", () => this._toggle_mute('_output'));
		this.actor.connect('scroll-event', (...args) => this.volume_selection['_output']._onScrollEvent(...args));
	}

	_setKeybinding() {
		// Main.keybindingManager.addHotKey("toggle-mute-" + this.instance_id, "Pause", Lang.bind(this, () => this._toggle_mute('_input')));
		Main.keybindingManager.addHotKey("use-headset-" + this.instance_id, "<Super>h", Lang.bind(this, () => this._toggle_setup("Headset")));
		Main.keybindingManager.addHotKey("use-speakers-" + this.instance_id, "<Super>s", Lang.bind(this, () => this._toggle_setup("Speakers")));
	}

	on_applet_removed_from_panel () {
		// Main.keybindingManager.removeHotKey("toggle-mute-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-headset-" + this.instance_id);
		Main.keybindingManager.removeHotKey("use-speakers-" + this.instance_id);
		this.settings.finalize();
		this.signals.disconnectAllSignals();
		this.menu.destroy();
	}


	_updateTooltip(actor, percentage) {
		this.set_applet_tooltip(_("Volume") + ": " + percentage);
	}
	
	_onButtonPressEvent (actor, event) {
		if (event.get_button() == 2) {
			this._toggle_mute('_input');
			return Clutter.EVENT_STOP;
		}
		return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
	}

	_toggle_mute(property) {
		global.log(`_toggle_mute:: ${property}`)
		if (!this.stream[property])
				return;

		this.stream[property].change_is_muted(
			!this.stream[property].is_muted
		);
	}

	_onDeviceAdded(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this.devices[type][full_name] = device;
		let options = this.generateSettingsOptions(type);
		this.settings.setOptions(`headset${type}`, options);
		this.settings.setOptions(`speakers${type}`, options);
		global.log(`_onDeviceAddedd::id=${id}, type=${type}, => ${full_name}`);
	}

	generateSettingsOptions(type) {
		let options = {};
		for (let device in this.devices[type]) {
			options[device] = device;
		}
		return options;
	}

	_onDeviceUpdate(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let stream =  this._control.get_stream_from_device(device);
		let full_name = `${device.origin}::${device.description}`;


		global.log(`_onDeviceUpdate:: id=${id}, type=${type}, card=${device.port_name} => |${full_name}|,  setup=> |${setup.HEADSET._output}| is muted ? ${stream.is_muted}`);
		this.volume_selection[type].connectWithStream(stream);
		if (type == "_output") {
			this._updateUi(full_name);
		}
	}

	_onControlStateChanged() {
		if (this._control.get_state() == Cvc.MixerControlState.READY) {
				this.actor.show();
		} else {
			this.actor.hide();
		}
	}

	_onMutedChanged(property) {

		this.mute_switch[property].setToggleState(this.stream[property].is_muted);
		let defaultColor = this.actor.get_theme_node().get_foreground_color();
		let style = 
			this.stream[property].is_muted ?
			"color: red;":
			"color: (%s,%s,%s,%s);".format(
				defaultColor.red,
				defaultColor.green,
				defaultColor.blue,
				defaultColor.alpha
			)
		;

		this._applet_icons[property].style = style;
		this.volume_selection[property].icon.style = style;

	}

	on_applet_clicked(event) {
		this.menu.toggle();
	}

	getDevice(type, direction) {
		let name = this.setup[`${type.toLowerCase()}${direction}`];
		return this.devices[direction][name];
	}
	
	_onSettingsChanged(value, item) {
		global.log(`_onSettingsChanged:: ${item}=${value}`);
		let active = (this.controls["Headset"]._dot != null) ? "Headset" : "Speakers";
		this._toggle_setup(active)
	}

	_onScrollEvent(actor, event) {
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }

		let step = 
			(event.get_scroll_direction() == Clutter.ScrollDirection.UP) ?
			VOLUME_ADJUSTMENT_STEP:
			-VOLUME_ADJUSTMENT_STEP
		;
		this.volume_selection['_output']._changeValue(step);
	}

	_onDeviceRemoved(control, id, type) {
		let device = this._control[`lookup${type}_id`](id);
		let full_name = `${device.origin}::${device.description}`;
		this.devices[type][full_name] = device;
		let options = this.generateSettingsOptions(type);
		this.settings.setOptions(`headset${type}`, options);
		this.settings.setOptions(`speakers${type}`, options);
		global.log(`_onDeviceRemoved::id=${id}, type=${type}, => ${full_name}`);
	}

	_onDefaultChanged(type, control, id) {
		global.log(`_onDefaultChanged:: id=${id}, type=${type}`);
		let stream = control.lookup_stream_id(id);
		if (!stream) {
			return;
		}
		let device = control.lookup_device_from_stream(stream);
		let full_name = `${device.origin}::${device.description}`;
		global.log(`_onDefaultChanged:: id=${id}, name=${full_name}`);
		this._rebindMute(type, stream);
		this.volume_selection[type].connectWithStream(stream);
		if (type =="_output") {
			this._updateUi(full_name);
		}
	}

	_rebindMute(type, stream) {
		if (this.mute_id[type]) {
			this.stream[type].disconnect(this.mute_id[type]);
			this.mute_id[type] = 0;
		}
		
		this.stream[type] = stream;
		this.mute_id[type] = stream.connect('notify::is-muted', () => this._onMutedChanged(type));
		this._onMutedChanged (type);
	}

	_updateUi(full_name) {
		global.log(`_updateUi:: init for ${full_name}`);
		let icon = '';
		let active = null;
		let inactive = null;
		if (full_name == this.setup["headset_output"]) {
			icon = "audio-headset-symbolic";
			active  = this.controls["Headset"];
			inactive = this.controls["Speakers"];
		} else {
			icon = "audio-speakers-symbolic";
			active  = this.controls["Speakers"];
			inactive = this.controls["Headset"];
		}

		active.setShowDot(true);
		inactive.setShowDot(false);
		Main.osdWindowManager.show(-1, Gio.Icon.new_for_string(icon), undefined);
		this.set_applet_icon_symbolic_name('_output', icon);
		this.mute_switch['_output'].setIconSymbolicName(icon);
		this.volume_selection['_output'].icon.set_icon_name(icon);
	}

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new SimpleSoundApplet(metadata, orientation, panelHeight, instanceId);
}