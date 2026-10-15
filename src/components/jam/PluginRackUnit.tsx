import { ReactNode } from 'react';
import { Power, LucideIcon, Maximize2, Minimize2 } from 'lucide-react';

interface PluginRackUnitProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  themeColor?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
  miniContent?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PluginRackUnit({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  themeColor = '#38bdf8',
  isCollapsed,
  onToggleCollapse,
  isBypassed = false,
  onToggleBypass,
  miniContent,
  children,
  className = '',
}: PluginRackUnitProps) {
  return (
    <article
      id={`plugin-${id}`}
      className={`plugin-rack-unit ${isCollapsed ? 'is-collapsed' : 'is-expanded'} ${isBypassed ? 'is-bypassed' : ''} ${className}`}
      style={{ '--unit-theme': themeColor } as React.CSSProperties}
    >
      <header className="plugin-rack-header" onClick={isCollapsed ? onToggleCollapse : undefined}>
        <div className="plugin-header-left">
          {onToggleBypass && (
            <button
              type="button"
              className={`plugin-power-btn ${!isBypassed ? 'power-on' : 'power-off'}`}
              onClick={e => {
                e.stopPropagation();
                onToggleBypass();
              }}
              title={isBypassed ? `${title} aktivieren` : `${title} bypassen`}
              aria-label={`${title} Ein/Aus`}
            >
              <Power size={13} />
            </button>
          )}

          <div className="plugin-icon-box" style={{ color: themeColor }}>
            <Icon size={16} />
          </div>

          <div className="plugin-title-group">
            <div className="plugin-name-row">
              <strong className="plugin-title">{title}</strong>
              {badge && <span className="plugin-badge">{badge}</span>}
            </div>
            {subtitle && !isCollapsed && <span className="plugin-subtitle">{subtitle}</span>}
          </div>
        </div>

        {/* Live Miniature View: plays in the background while minimized */}
        {isCollapsed && miniContent && (
          <div className="plugin-mini-display" onClick={e => e.stopPropagation()}>
            {miniContent}
          </div>
        )}

        <div className="plugin-header-actions" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            className="plugin-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? `${title} ausklappen` : `${title} minimieren`}
            aria-label={isCollapsed ? `${title} ausklappen` : `${title} minimieren`}
          >
            {isCollapsed ? (
              <>
                <Maximize2 size={13} />
                <span className="btn-txt">Erweitern</span>
              </>
            ) : (
              <>
                <Minimize2 size={13} />
                <span className="btn-txt">Minimieren</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Expanded Plugin Body */}
      {!isCollapsed && <div className="plugin-rack-body">{children}</div>}
    </article>
  );
}
