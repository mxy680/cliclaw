import { colors, typography } from "@/styles/tokens";

function ColorSwatch({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          backgroundColor: value,
          border: "1px solid rgb(46, 46, 46)",
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 12, color: "rgb(107, 107, 107)" }}>{value}</div>
      </div>
    </div>
  );
}

function TypographySample({
  name,
  style,
}: {
  name: string;
  style: (typeof typography)[keyof typeof typography];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          color: "rgb(107, 107, 107)",
          marginBottom: 4,
        }}
      >
        {name} — {style.fontSize} / {style.fontWeight}
      </div>
      <div
        style={{
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
        }}
      >
        The quick brown fox jumps over the lazy dog
      </div>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      <h1
        style={{
          fontSize: 44,
          fontWeight: 400,
          lineHeight: "1.1em",
          letterSpacing: "-0.03em",
          marginBottom: 48,
        }}
      >
        Style Guide
      </h1>

      {/* Colors */}
      <section style={{ marginBottom: 64 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          Colors
        </h2>

        {Object.entries(colors).map(([groupName, group]) => (
          <div key={groupName} style={{ marginBottom: 32 }}>
            <h3
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                color: "rgb(107, 107, 107)",
                marginBottom: 12,
              }}
            >
              {groupName}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {Object.entries(group).map(([name, value]) => (
                <ColorSwatch
                  key={name}
                  name={`${groupName}.${name}`}
                  value={value}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Typography */}
      <section style={{ marginBottom: 64 }}>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          Typography
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "rgb(149, 149, 149)",
            marginBottom: 32,
          }}
        >
          All typography uses the Geist font family with -0.03em letter spacing.
        </p>

        {Object.entries(typography).map(([name, style]) => (
          <TypographySample key={name} name={name} style={style} />
        ))}
      </section>

      {/* Component Gallery placeholder */}
      <section>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          Components
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "rgb(149, 149, 149)",
            marginBottom: 16,
          }}
        >
          Framer components will be rendered here after export. See{" "}
          <code
            style={{
              backgroundColor: "rgb(26, 26, 26)",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            src/framer/
          </code>{" "}
          for all exported components.
        </p>
      </section>
    </main>
  );
}
