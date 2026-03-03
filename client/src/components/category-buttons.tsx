import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dog, Cat, Bird, Rabbit, Fish, Shapes } from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "dog", label: "Dogs", icon: Dog },
  { id: "cat", label: "Cats", icon: Cat },
  { id: "bird", label: "Birds", icon: Bird },
  { id: "rabbit", label: "Rabbits", icon: Rabbit },
  { id: "fish", label: "Fish", icon: Fish },
  { id: "other", label: "Other", icon: Shapes },
];

interface CategoryButtonsProps {
  active?: string;
  onSelect?: (category: string) => void;
  showAll?: boolean;
}

export function CategoryButtons({ active, onSelect, showAll = false }: CategoryButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="category-buttons">
      {showAll && (
        <Button
          variant={!active ? "default" : "secondary"}
          size="sm"
          onClick={() => onSelect?.("")}
          data-testid="button-category-all"
        >
          All
        </Button>
      )}
      {categories.map((cat) =>
        onSelect ? (
          <Button
            key={cat.id}
            variant={active === cat.id ? "default" : "secondary"}
            size="sm"
            onClick={() => onSelect(cat.id)}
            data-testid={`button-category-${cat.id}`}
          >
            <cat.icon className="w-4 h-4 mr-1.5" />
            {cat.label}
          </Button>
        ) : (
          <Link key={cat.id} href={`/category/${cat.id}`}>
            <Button
              variant={active === cat.id ? "default" : "secondary"}
              size="sm"
              data-testid={`button-category-${cat.id}`}
            >
              <cat.icon className="w-4 h-4 mr-1.5" />
              {cat.label}
            </Button>
          </Link>
        )
      )}
    </div>
  );
}
