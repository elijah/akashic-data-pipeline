# Makefile for Akashic project

# Clean generated JS/TSX files that have corresponding TS source files
clean:
	@find . \( -name "*.js" -o -name "*.tsx" \) -mindepth 1 -not -path './node_modules/*' -not -path './.git/*' | while read -r file; do \
		tsfile="${file%.*}.ts"; \
		if [ -f "$$tsfile" ]; then \
			echo "Removing $$file (has corresponding $$tsfile)"; \
			rm "$$file"; \
		else \
			echo "Skipping $$file (no corresponding .ts file)"; \
		fi; \
	done

.PHONY: clean