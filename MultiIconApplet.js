const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

function log(error) {
	// global.logError(error);
}

class MultiIconApplet extends imports.ui.applet.Applet {
	constructor(orientation, panel_height, instance_id) {
			super(orientation, panel_height, instance_id);
			log('constructor::init');
			this._applet_icon_boxes = new Array(2);   //array of containers
			this._applet_icons = new Array(2);        //array of icons
			this._applet_icon_boxes['_input'] = this._init_icon_box();
			this._applet_icon_boxes['_output'] = this._init_icon_box();
			log('constructor::done');
	}

	_init_icon_box() {
		log('_init_icon_box::init');
		const box = new St.Bin();
		box.set_fill(true,true);
		box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
		this.actor.add(box);		
		log('_init_icon_box::done');
		return box;
	}

	_ensureIcon(name) {
		log(`_ensureIcon::init for -> ${name}`);
		if (!this._applet_icons[name] ||
				!(this._applet_icons[name] instanceof St.Icon))
				this._applet_icons[name] = new St.Icon({
						reactive: true, track_hover: true,
						style_class: 'applet-icon'
				});
		this._applet_icon_boxes[name].set_child(this._applet_icons[name]);
		log('_ensureIcon::done');
	}

	set_applet_icon_name (name, icon_name) {
			this._ensureIcon(name);
			this._applet_icons[name].set_icon_name(icon_name);
			this._applet_icons[name].set_icon_type(St.IconType.FULLCOLOR);
			this._setStyle(name);
	}

	set_applet_icon_symbolic_name (name, icon_name) {
		log(`set_applet_icon_symbolic_name::init for -> ${name}`);
		this._ensureIcon(name);
		this._applet_icons[name].set_icon_name(icon_name);
		this._applet_icons[name].set_icon_type(St.IconType.SYMBOLIC);
		this._setStyle(name);
		log('set_applet_icon_symbolic_name::done');
	}

	set_applet_icon_path (name, icon_path) {
			this._ensureIcon(name);

			try {
					let file = Gio.file_new_for_path(icon_path);
					this._applet_icons[name].set_gicon(new Gio.FileIcon({ file: file }));
					this._applet_icons[name].set_icon_type(St.IconType.FULLCOLOR);
					this._setStyle(name);
			} catch (e) {
					global.log(e);
			}
	}

	set_applet_icon_symbolic_path(name, icon_path) {
			this._ensureIcon(name);
			try {
					let file = Gio.file_new_for_path(icon_path);
					this._applet_icons[name].set_gicon(new Gio.FileIcon({ file: file }));
					this._applet_icons[name].set_icon_type(St.IconType.SYMBOLIC);
					this._setStyle(name);
			} catch (e) {
					global.log(e);
			}
	}

	_setStyle(name) {
			let icon_type = this._applet_icons[name].get_icon_type();

			if (icon_type === St.IconType.FULLCOLOR) {
					this._applet_icons[name].set_icon_size(this.getPanelIconSize(St.IconType.FULLCOLOR));
					this._applet_icons[name].set_style_class_name('applet-icon');
			} else {
					this._applet_icons[name].set_icon_size(this.getPanelIconSize(St.IconType.SYMBOLIC));
					this._applet_icons[name].set_style_class_name('system-status-icon');
			}
	}

	on_panel_height_changed_internal() {
		if (this._applet_icons['_input'])
			this._setStyle('_input');

		if (this._applet_icons['_output'])
			this._setStyle('_output');

		this.on_panel_height_changed();
	}

	on_orientation_changed(neworientation) {
		this.orientation = neworientation;

		if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
				this.actor.set_vertical(false);
		else
				this.actor.set_vertical(true);
	}	
}

module.exports = {MultiIconApplet}