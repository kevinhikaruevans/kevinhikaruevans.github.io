---
title: My first Python package: pydantic-sqlalchemy-deco
description: My foray into Python
date: 2024-12-18
tags: programming
---

Today, I released my first Python package!

Well... I suppose it actually isn't my _first_ Python package, since we often create locally-installable packages for clients. But rather, it's [my first one published on pypi](https://pypi.org/project/pydantic-sqlalchemy-deco/)!

It doesn't do much, but it's something that has been bugging me for a while. For clients, I often include Pydantic models in SQLAlchemy-created databases. Normally, I just use `JSONB` and use the regular ol' `model_validate` functions. While this works, I'd prefer it to be automatic. Here's where `pydantic-sqlalchemy-deco` comes in.

It's a simple `TypeDecorator` class that automatically converts between Pydantic and SQLAlchemy JSONB types. 

## Installation

Since it's pip installable, you can use `pip install pydantic_sqlalchemy_deco`.

## Usage

All you need to do is set the `Mapped[]` type and include `PydanticJSON` in the `mapped_column()`, like such:

```python
from pydantic_sqlalchemy_deco.decorator import PydanticJSON

...

# Define Pydantic model somewhere:
class MyCustomModel(BaseModel):
    custom_id: int = 0


# Define your SQLAlchemy model:
class MyEntry(Base):

    custom_data: Mapped[MyCustomModel] = mapped_column(PydanticJSON(MyCustomModel))

```

Then it's easy as doing

```python
entry = MyEntry(
    custom_data=MyCustomModel(custom_id=1234)
)

...

print(entry.custom_data.custom_id)
```

Pretty simple, eh?

## Further remarks

I never realized how easy it is to build Python packages. It's basically:

1. write your code
2. define your pyproject.toml file
3. then setup the default Github action to push releases to pypi.

That's it! I was expecting a whole mess of generating and keeping track of tokens, writing and rewriting Github actions, and some CLI work to get it published. 

I'll eventually need to do tests, but I can hold off on those til later. 

## Links

- [pydantic_sqlalchemy_deco on pypi](https://pypi.org/project/pydantic-sqlalchemy-deco/)
- [pydantic-sqlalchemy-type-decorator on Github](https://github.com/kevinhikaruevans/pydantic-sqlalchemy-type-decorator)