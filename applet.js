const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const {VolumeSlider} = require('./VolumeSlider');
const {MultiIconApplet} = require('./MultiIconApplet');
const {MediaPlayer} = require('./MediaPlayer');
const {SignalManager} = imports.misc.signalManager;
const {AudioController} = require('./AudioController');
const {LogUtils} = require(`./LogUtils`)
const LOG = new LogUtils();

const VOLUME_ADJUSTMENT_STEP = 0.05; /* Volume adjustment step in % */

class SimpleSoundApplet extends MultiIconApplet {
	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId, ['source', 'sink']);
		this._metadata = metadata;
		this.set_applet_icon_symbolic_name('source','audio-input-microphone-symbolic');
		this.set_applet_icon_symbolic_name('sink','audio-headset-symbolic');
		this.mute_switch = [];
		this.volume_selection = [];
		this._signalManager = new SignalManager(null);
		this._controls = {};
		// this._setup = {};
		this.teste = "Applet";

		this._controller = new AudioController();
		this._volumeMax = this._controller.volumeMax;
		this._volumeNorm = this._controller.volumeNorm;

		this._drawMenu(orientation);
		this._setupListeners();

		this._setKeybinding();

		this._player = new MediaPlayer(this);
	}


	_drawMenu(orientation) {
		// controles
		this.mute_switch['sink'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute output"), false, "audio-headset-symbolic", St.IconType.SYMBOLIC);
		this.mute_switch['source'] = new PopupMenu.PopupSwitchIconMenuItem(_("Mute input"), false, "audio-input-microphone-symbolic", St.IconType.SYMBOLIC);
		this.volume_selection['sink'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Volume"), 'audio-headset-symbolic');
		this.volume_selection['source'] = new VolumeSlider(true, this._volumeMax, this._volumeNorm, _("Microphone"), 'audio-input-microphone-symbolic');

		// menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

        this._chooseActivePlayerItem = new PopupMenu.PopupSubMenuMenuItem(_("Choose player controls"));
        this.menu.addMenuItem(this._chooseActivePlayerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// botoes de mute
		this.menu.addMenuItem(this.mute_switch['source']);
		this.menu.addMenuItem(this.mute_switch['sink']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.menu.addMenuItem(this._drawSelection("Headset"));
		this.menu.addMenuItem(this._drawSelection("Speakers"));

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// deslizantes de volume
		this.menu.addMenuItem(this.volume_selection['source']);
		this.menu.addMenuItem(this.volume_selection['sink']);

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		// ajustes
		this.menu.addSettingsAction(_("Sound Settings"), 'sound');
		this.menu.addCommandlineAction(_("Pulse Audio Settings"), 'pavucontrol');

	}

	_drawSelection(type){
		let device = new PopupMenu.PopupMenuItem(type);
		let bin = new St.Bin({ x_align: St.Align.END, style_class: 'popup-active-menu-item' });
		device.addActor(bin, { expand: false, span: -1, align: St.Align.END });
		device.activate = () => this._controller.toggle_setup(type);
		this._controls[type] = device;
		return device;
	}

    _getDevice(type, direction) {
		let name = this._applet.setup[`${type.toLowerCase()}${direction}`]; //adjust
		return this._devices[direction][name];
	}

	_setupListeners() {
		for (let name in this.mute_switch){
			let item =  this.mute_switch[name];
			LOG.info(`connect for mute_switch[${name}]`)
			this._signalManager.connect(item, 'toggled',() => this._controller.toggle_mute(name), this, true);
		};

		for (let name in this.volume_selection) {
			let item = this.volume_selection[name];
			this._signalManager.connect(item, 'toggle-mute',() => this._controller.toggle_mute(name), this, true);
		};

		this._signalManager.connect(this.volume_selection['sink'], 'volume-changed',this._updateTooltip, this, true);
		this._signalManager.connect(this.actor, 'scroll-event', this.volume_selection['sink']._onScrollEvent, this.volume_selection['sink']);
		this._signalManager.connect(this._controller, 'default-changed', this._setDefaultDevice, this, true);
		this._signalManager.connect(this._controller, 'control-state-changed', this._onAudioControllerStateChanged, this, true);
		this._signalManager.connect(this._controller, 'change-mute', this._onMutedChanged, this, true);

	}

	_setKeybinding() {
		Main.keybindingManager.addHotKey("use-headset-" + this.instance_id, "<Super>h", Lang.bind(this, () => this._controller.toggle_setup("Headset")));
		Main.keybindingManager.addHotKey("use-speakers-" + this.instance_id, "<Super>s", Lang.bind(this, () => this._controller.toggle_setup("Speakers")));
	}

	on_applet_removed_from_panel () {
		this._signalManager.disconnectAllSignals();
		this.menu.destroy();
		this._player.destroy();
		this._controller.destroy();
	}


	_updateTooltip(actor, percentage) {
		this.set_applet_tooltip(_("Volume") + ": " + percentage);
	}
	
	_onButtonPressEvent (actor, event) {
		if (event.get_button() == 2) {
			this._controller.toggle_mute('source');
			return Clutter.EVENT_STOP;
		}
		return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
	}

	_onAudioControllerStateChanged(controller, online) {
		if (online) {
			this.actor.show();
		} else {
			this.actor.hide();
		}
	}

	_onMutedChanged(controller, direction, muted) {
		this.mute_switch[direction].setToggleState(muted); // adjust, refactor into controller method
		let defaultColor = this.actor.get_theme_node().get_foreground_color();
		let style = 
			muted ?
			"color: red;":
			"color: (%s,%s,%s,%s);".format(
				defaultColor.red,
				defaultColor.green,
				defaultColor.blue,
				defaultColor.alpha
			)
		;

		this._applet_icons[direction].style = style;
		this.volume_selection[direction].icon.style = style;

	}

	on_applet_clicked(event) {
		this.menu.toggle();
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
		this.volume_selection['sink']._changeValue(step);
	}

	_updateUi(type) {
		global.log(`_updateUi:: init for ${type}`);
		let icon = '';
		let active = null;
		let inactive = null;
		if (type == "Headset") {
			icon = "audio-headset-symbolic";
			active  = this._controls["Headset"];
			inactive = this._controls["Speakers"];
		} else {
			icon = "audio-speakers-symbolic";
			active  = this._controls["Speakers"];
			inactive = this._controls["Headset"];
		}

		active.setShowDot(true);
		inactive.setShowDot(false);
		Main.osdWindowManager.show(-1, Gio.Icon.new_for_string(icon), undefined);
		this.set_applet_icon_symbolic_name('sink', icon);
		this.mute_switch['_output'].setIconSymbolicName(icon);
		this.volume_selection['_output'].icon.set_icon_name(icon);
	}

	_setDefaultDevice(emmitter, type, direction, stream){
		LOG.init();
		LOG.info(`type={${type}}, direction={${direction}}, stream={${stream}}`)
		this.volume_selection[direction].connectWithStream(stream);
		if (direction =="sink") {
			this._updateUi(type);
		}
	}

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new SimpleSoundApplet(metadata, orientation, panelHeight, instanceId);
}